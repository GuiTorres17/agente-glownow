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
    """Confirma o sinal de um agendamento."""
    extrair_token(authorization)

    if SUPABASE_DISPONIVEL:
        from agente import supabase
        try:
            # Buscar agendamento — usa preco_cobrado (armazenado no momento do booking)
            res = supabase.table('agendamentos') \
                .select('*, servicos(preco)') \
                .eq('id', payload.agendamento_id) \
                .execute()

            if not res.data:
                raise HTTPException(status_code=404, detail="Agendamento não encontrado")

            agendamento = res.data[0]

            # Prioridade: preco_cobrado > servicos.preco > fallback 0
            preco = agendamento.get('preco_cobrado') or 0
            if not preco and agendamento.get('servicos'):
                preco = agendamento['servicos'].get('preco', 0)

            sinal_valor = preco * 0.4

            supabase.table('agendamentos').update({
                'sinal_pago': sinal_valor,
                'valor_sinal': sinal_valor,
                'status': 'confirmado',
            }).eq('id', payload.agendamento_id).execute()

            return {"success": True, "sinal_pago": sinal_valor}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Erro ao confirmar sinal: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao confirmar sinal: {str(e)}")
    else:
        # Modo demo
        return {"success": True, "sinal_pago": 12.0, "demo": True}


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
