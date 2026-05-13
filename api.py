"""
API FastAPI que expõe o agente da Lino Esmalteria.
Roda em http://localhost:8000 e é exposta via Cloudflare Tunnel.
"""
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import os
import secrets
import datetime

# Importa o motor do seu agente
from agente import MotorDialogo, obter_servicos, obter_manicures, SUPABASE_DISPONIVEL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

app = FastAPI(title="Lino Esmalteria Agent API")

# CORS liberado para o frontend Lovable conseguir chamar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

motor = MotorDialogo()

# ---------------------------------------------------------------------------
# CREDENCIAIS ADMIN (hardcoded)
# ---------------------------------------------------------------------------
ADMIN_USERNAME = "esmalteria123"
ADMIN_PASSWORD = "esmalteria@123"

# Tokens ativos de sessão admin { token: timestamp_criacao }
admin_tokens: dict[str, float] = {}
TOKEN_EXPIRY_HOURS = 8


def gerar_token_admin() -> str:
    """Gera um token seguro e armazena."""
    token = secrets.token_hex(32)
    admin_tokens[token] = datetime.datetime.now().timestamp()
    return token


def validar_token_admin(token: str) -> bool:
    """Valida se o token existe e não expirou."""
    if token not in admin_tokens:
        return False
    criado_em = admin_tokens[token]
    agora = datetime.datetime.now().timestamp()
    if agora - criado_em > TOKEN_EXPIRY_HOURS * 3600:
        del admin_tokens[token]
        return False
    return True


def extrair_token(authorization: str | None) -> str:
    """Extrai o token do header Authorization: Bearer <token>."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Formato de token inválido")
    token = parts[1]
    if not validar_token_admin(token):
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    return token


# ---------------------------------------------------------------------------
# MODELOS
# ---------------------------------------------------------------------------
class ChatPayload(BaseModel):
    message: str
    user_id: str = "web-user"


class AdminLoginPayload(BaseModel):
    username: str
    password: str


class ConfirmarSinalPayload(BaseModel):
    agendamento_id: int


class AtualizarStatusPayload(BaseModel):
    agendamento_id: int
    status: str


class CancelarAgendamentoPayload(BaseModel):
    agendamento_id: int


class ServicoPayload(BaseModel):
    categoria: str
    nome: str
    preco: float
    duracao: int = 60
    descricao: str = ""
    ativo: bool = True


class ManicurePayload(BaseModel):
    nome: str
    especialidades: list = []
    horarios_disponiveis: dict = {}
    bio: str = ""
    ativo: bool = True


DIAS_TRABALHO = [1, 2, 3, 4, 5]  # Ter-Sáb (weekday: 0=Seg)

def validar_dia_funcionamento(data_str: str) -> bool:
    """Valida se a data NÃO cai em Domingo ou Segunda."""
    try:
        parts = data_str.split("/")
        d = datetime.datetime(int(parts[2]), int(parts[1]), int(parts[0]))
        return d.weekday() in DIAS_TRABALHO
    except Exception:
        return True


# ---------------------------------------------------------------------------
# ENDPOINTS PÚBLICOS
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "Lino Esmalteria Agent"}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/chat")
def chat(payload: ChatPayload):
    logger.info(f"[{payload.user_id}] >>> {payload.message}")
    try:
        resposta = motor.processar_mensagem(payload.user_id, payload.message)
        # resposta já vem no formato {id, text, from, time, status}
        texto = resposta.get("text", "") if isinstance(resposta, dict) else str(resposta)
        logger.info(f"[{payload.user_id}] <<< {texto[:80]}")
        return {"reply": texto, "raw": resposta}
    except Exception as e:
        logger.exception("Erro no /chat")
        return {"reply": f"⚠️ Erro interno: {e}"}


# ---------------------------------------------------------------------------
# ENDPOINTS ADMIN
# ---------------------------------------------------------------------------
@app.post("/admin/login")
def admin_login(payload: AdminLoginPayload):
    """Autentica funcionário com credenciais fixas."""
    if payload.username == ADMIN_USERNAME and payload.password == ADMIN_PASSWORD:
        token = gerar_token_admin()
        logger.info("Admin login bem-sucedido")
        return {"success": True, "token": token}
    logger.warning(f"Tentativa de login admin falhou: {payload.username}")
    raise HTTPException(status_code=401, detail="Credenciais inválidas")


@app.get("/admin/dashboard")
def admin_dashboard(
    authorization: str | None = Header(default=None),
    date: str | None = None,
):
    """Retorna dados do painel administrativo para uma data específica.
    Se `date` não for passado, usa a data de hoje. Formato: DD/MM/YYYY.
    """
    extrair_token(authorization)

    agendamentos, data_str = motor._obter_agendamentos_do_dia(date)

    # Calcular KPIs
    faturamento = sum(a['servico_preco'] for a in agendamentos)
    confirmados = [a for a in agendamentos if a.get('sinal_pago') and a['sinal_pago'] > 0]
    pendentes = [a for a in agendamentos if not a.get('sinal_pago') or a['sinal_pago'] == 0]

    return {
        "data": data_str,
        "agendamentos": agendamentos,
        "kpis": {
            "faturamento_previsto": faturamento,
            "confirmados": len(confirmados),
            "pendentes": len(pendentes),
            "total_clientes": len(agendamentos),
        }
    }


@app.get("/admin/monthly")
def admin_monthly(
    authorization: str | None = Header(default=None),
    month: int | None = None,
    year: int | None = None,
):
    """Retorna resumo mensal: para cada dia do mês, quantos agendamentos e faturamento.
    Se month/year não forem passados, usa o mês atual.
    """
    extrair_token(authorization)

    hoje = datetime.datetime.now()
    mes = month or hoje.month
    ano = year or hoje.year

    import calendar
    _, dias_no_mes = calendar.monthrange(ano, mes)

    resumo_dias = []
    for dia in range(1, dias_no_mes + 1):
        data_str = f"{dia:02d}/{mes:02d}/{ano}"
        agendamentos, _ = motor._obter_agendamentos_do_dia(data_str)
        total = len(agendamentos)
        faturamento = sum(a['servico_preco'] for a in agendamentos)
        confirmados = len([a for a in agendamentos if a.get('sinal_pago') and a['sinal_pago'] > 0])
        resumo_dias.append({
            "dia": dia,
            "data": data_str,
            "total": total,
            "confirmados": confirmados,
            "pendentes": total - confirmados,
            "faturamento": faturamento,
        })

    return {
        "mes": mes,
        "ano": ano,
        "dias": resumo_dias,
    }


@app.post("/admin/confirmar-sinal")
def admin_confirmar_sinal(
    payload: ConfirmarSinalPayload,
    authorization: str | None = Header(default=None),
):
    """Confirma o recebimento do sinal de um agendamento."""
    extrair_token(authorization)

    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            # Buscar agendamento com dados de preço
            res = supabase.table('agendamentos') \
                .select('*, servicos(preco)') \
                .eq('id', payload.agendamento_id) \
                .execute()

            if not res.data:
                raise HTTPException(status_code=404, detail="Agendamento não encontrado")

            agendamento = res.data[0]

            # Calcular sinal: preco_cobrado > valor_sinal > servicos.preco > 0
            preco = agendamento.get('preco_cobrado') or 0
            if not preco and agendamento.get('servicos'):
                preco = agendamento['servicos'].get('preco', 0)

            sinal_valor = agendamento.get('valor_sinal') or (preco * 0.4)

            # Atualizar: sinal pago + flag de confirmação manual
            supabase.table('agendamentos').update({
                'sinal_pago': sinal_valor,
                'valor_sinal': sinal_valor,
                'sinal_confirmado': True,
                'status': 'confirmado',
            }).eq('id', payload.agendamento_id).execute()

            logger.info(f"Sinal confirmado manualmente: agendamento #{payload.agendamento_id} → R$ {sinal_valor:.2f}")
            return {"success": True, "sinal_pago": sinal_valor, "sinal_confirmado": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Erro ao confirmar sinal: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao confirmar sinal: {str(e)}")
    else:
        # Modo demo
        return {"success": True, "sinal_pago": 12.0, "sinal_confirmado": True, "demo": True}


@app.post("/admin/atualizar-status")
def admin_atualizar_status(
    payload: AtualizarStatusPayload,
    authorization: str | None = Header(default=None),
):
    """Atualiza o status de um agendamento."""
    extrair_token(authorization)

    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            supabase.table('agendamentos').update({
                'status': payload.status,
            }).eq('id', payload.agendamento_id).execute()
            return {"success": True}
        except Exception as e:
            logger.error(f"Erro ao atualizar status: {e}")
            raise HTTPException(status_code=500, detail="Erro ao atualizar status")
    else:
        return {"success": True, "demo": True}


@app.post("/admin/logout")
def admin_logout(authorization: str | None = Header(default=None)):
    """Invalida o token de sessão."""
    try:
        token = extrair_token(authorization)
        if token in admin_tokens:
            del admin_tokens[token]
    except Exception:
        pass
    return {"success": True}


# ---------------------------------------------------------------------------
# CRUD SERVIÇOS
# ---------------------------------------------------------------------------
@app.get("/admin/servicos")
def admin_listar_servicos(authorization: str | None = Header(default=None)):
    """Lista todos os serviços (ativos e inativos)."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        res = supabase.table('servicos').select('*').order('categoria').order('nome').execute()
        return {"servicos": res.data or []}
    return {"servicos": []}


@app.post("/admin/servicos")
def admin_criar_servico(payload: ServicoPayload, authorization: str | None = Header(default=None)):
    """Cria um novo serviço."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            res = supabase.table('servicos').insert({
                'categoria': payload.categoria,
                'nome': payload.nome,
                'preco': payload.preco,
                'duracao': payload.duracao,
                'descricao': payload.descricao,
                'ativo': payload.ativo,
            }).execute()
            return {"success": True, "servico": res.data[0] if res.data else None}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "demo": True}


@app.put("/admin/servicos/{servico_id}")
def admin_editar_servico(servico_id: int, payload: ServicoPayload, authorization: str | None = Header(default=None)):
    """Edita um serviço existente."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            res = supabase.table('servicos').update({
                'categoria': payload.categoria,
                'nome': payload.nome,
                'preco': payload.preco,
                'duracao': payload.duracao,
                'descricao': payload.descricao,
                'ativo': payload.ativo,
            }).eq('id', servico_id).execute()
            return {"success": True, "servico": res.data[0] if res.data else None}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "demo": True}


@app.delete("/admin/servicos/{servico_id}")
def admin_excluir_servico(servico_id: int, authorization: str | None = Header(default=None)):
    """Soft-delete de um serviço (ativo = false)."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            supabase.table('servicos').update({'ativo': False}).eq('id', servico_id).execute()
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "demo": True}


# ---------------------------------------------------------------------------
# CRUD MANICURES
# ---------------------------------------------------------------------------
@app.get("/admin/manicures")
def admin_listar_manicures(authorization: str | None = Header(default=None)):
    """Lista todas as manicures (ativas e inativas)."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        res = supabase.table('manicures').select('*').order('nome').execute()
        return {"manicures": res.data or []}
    return {"manicures": []}


@app.post("/admin/manicures")
def admin_criar_manicure(payload: ManicurePayload, authorization: str | None = Header(default=None)):
    """Cadastra nova manicure."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            import json
            res = supabase.table('manicures').insert({
                'nome': payload.nome,
                'especialidades': payload.especialidades,
                'horarios_disponiveis': payload.horarios_disponiveis,
                'bio': payload.bio,
                'ativo': payload.ativo,
                'role': 'manicure',
            }).execute()
            return {"success": True, "manicure": res.data[0] if res.data else None}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "demo": True}


@app.put("/admin/manicures/{manicure_id}")
def admin_editar_manicure(manicure_id: int, payload: ManicurePayload, authorization: str | None = Header(default=None)):
    """Edita dados de uma manicure."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            res = supabase.table('manicures').update({
                'nome': payload.nome,
                'especialidades': payload.especialidades,
                'horarios_disponiveis': payload.horarios_disponiveis,
                'bio': payload.bio,
                'ativo': payload.ativo,
            }).eq('id', manicure_id).execute()
            return {"success": True, "manicure": res.data[0] if res.data else None}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "demo": True}


@app.delete("/admin/manicures/{manicure_id}")
def admin_excluir_manicure(manicure_id: int, authorization: str | None = Header(default=None)):
    """Soft-delete de manicure (ativo = false)."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            supabase.table('manicures').update({'ativo': False}).eq('id', manicure_id).execute()
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "demo": True}


# ---------------------------------------------------------------------------
# CANCELAMENTO MANUAL
# ---------------------------------------------------------------------------
@app.post("/admin/cancelar-agendamento")
def admin_cancelar_agendamento(payload: CancelarAgendamentoPayload, authorization: str | None = Header(default=None)):
    """Cancela um agendamento manualmente (status='cancelado')."""
    extrair_token(authorization)
    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            supabase.table('agendamentos').update({
                'status': 'cancelado',
            }).eq('id', payload.agendamento_id).execute()
            logger.info(f"Agendamento #{payload.agendamento_id} cancelado manualmente pelo admin")
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "demo": True}


# ---------------------------------------------------------------------------
# RESUMO SEMANAL (para gráficos do dashboard)
# ---------------------------------------------------------------------------
@app.get("/admin/weekly-summary")
def admin_weekly_summary(authorization: str | None = Header(default=None)):
    """Retorna faturamento e contagem dos últimos 7 dias para gráficos."""
    extrair_token(authorization)
    hoje = datetime.datetime.now()
    dias = []
    nomes_dia = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    for i in range(6, -1, -1):
        d = hoje - datetime.timedelta(days=i)
        data_str = d.strftime("%d/%m/%Y")
        agendamentos, _ = motor._obter_agendamentos_do_dia(data_str)
        total = len(agendamentos)
        faturamento = sum(a['servico_preco'] for a in agendamentos)
        confirmados = len([a for a in agendamentos if a.get('sinal_pago') and a['sinal_pago'] > 0])
        dias.append({
            "dia": nomes_dia[d.weekday()],
            "data": data_str,
            "total": total,
            "confirmados": confirmados,
            "pendentes": total - confirmados,
            "faturamento": faturamento,
        })
    return {"dias": dias}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
