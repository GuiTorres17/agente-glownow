import datetime
import time
import json
import logging
import random
import re
import os
import difflib
from supabase import create_client, Client
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Carregar variáveis de ambiente
load_dotenv()

# Configuração de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO DO SUPABASE
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        SUPABASE_DISPONIVEL = True
        logger.info(f"Conexão com Supabase estabelecida: {SUPABASE_URL}")
    else:
        raise Exception("SUPABASE_URL ou SUPABASE_KEY não encontradas no .env")
except Exception as e:
    logger.warning(f"Supabase não disponível: {e}. Usando modo demo.")
    SUPABASE_DISPONIVEL = False

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO DO GEMINI
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_DISPONIVEL = False

if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        GEMINI_DISPONIVEL = True
        logger.info("Gemini configurado com sucesso")
    except Exception as e:
        logger.warning(f"Erro ao configurar Gemini: {e}")
else:
    gemini_client = None

# System prompt — define o comportamento e limites da IA
SYSTEM_PROMPT = """
Você é a assistente virtual da Lino Esmalteria, uma esmalteria especializada em cuidados com unhas.
Seu nome é Lina e você é simpática, atenciosa e profissional.

REGRAS OBRIGATÓRIAS:
1. Responda SEMPRE em português do Brasil.
2. Seja breve e objetiva — respostas de no máximo 3-4 linhas.
3. Use emojis com moderação (1-2 por mensagem no máximo).
4. Fale APENAS sobre assuntos relacionados à esmalteria: serviços, agendamentos, cuidados com unhas, preços e atendimento.
5. Se perguntarem algo fora desse tema, diga educadamente que só pode ajudar com assuntos da esmalteria.
6. NUNCA invente preços, horários ou disponibilidade. Para isso, oriente o cliente a digitar:
   - "serviços" para ver preços
   - "agendar" para marcar um horário
   - "login" para entrar na conta
7. Não finalize agendamentos — isso é feito pelo sistema de forma guiada.
8. Se o cliente quiser agendar, diga para digitar "agendar".

Serviços que oferecemos (use como referência geral, não cite preços específicos):
- Manicure, Pedicure, Esmaltação em gel, Alongamento de unhas, Fibra de vidro, Spa dos pés, Design e decoração de unhas.

Horário de funcionamento: Segunda a Sábado, das 09h às 18h.
"""

# ---------------------------------------------------------------------------
# CONFIGURAÇÕES DO NEGÓCIO
# ---------------------------------------------------------------------------
CONFIG_NEGOCIO = {
    'horario_abertura': '09:00',
    'horario_fechamento': '18:00',
    'intervalo_entre_clientes': 15,
    'horarios_lembrete': ['18:00', '09:00'],
    'dias_trabalho': [0, 1, 2, 3, 4, 5],  # seg a sab
}

# ---------------------------------------------------------------------------
# ASSISTENTE IA — Gemini para conversa natural, predefinidas como fallback
# ---------------------------------------------------------------------------
class AssistenteIA:
    def __init__(self):
        self.historico_conversas = {}

        # Palavras-chave para detectar intenções e acionar o fluxo guiado
        self.intencoes_agendamento = ['agendar', 'marcar', 'horário', 'horario',
                                       'quero marcar', 'quero agendar', 'reservar']
        self.intencoes_servicos   = ['serviço', 'servico', 'serviços', 'preço',
                                      'valor', 'quanto custa', 'tabela']
        self.intencoes_login      = ['login', 'entrar', 'logar', 'minha conta', 'ja tenho conta', 'já tenho conta']
        self.intencoes_cadastro   = ['cadastrar', 'cadastro', 'criar conta', 'nova conta', 'registrar', 'me cadastrar', 'quero me cadastrar', 'sou nova', 'primeira vez']

        # Intenções do painel administrativo (desabilitado no chat público
        # — acesso exclusivo pelo painel admin com login)
        self.intencoes_admin      = []

        # Respostas predefinidas — usadas como fallback se o Gemini falhar
        self.respostas_predefinidas = {
            "saudacao": [
                "Oii, tudo bem? Seja bem-vinda à Lino Esmalteria! 💖 Me conta, no que posso te ajudar?",
                "Oi, que bom te ver por aqui! 💅 Me fala, o que você tá precisando?",
                "Olá! Que bom que entrou em contato com a gente! Como posso te ajudar hoje?",
            ],
            "agradecimento": [
                "Imagina, foi um prazer! Se precisar de qualquer coisa, é só chamar 😊",
                "De nada, linda! Qualquer coisa estou por aqui 💖",
                "Por nada! Fico feliz em ajudar. Conta comigo sempre! ✨",
            ],
            "despedida": [
                "Tchau, se cuida! Espero te ver em breve por aqui 🌸",
                "Até mais! Tenha um dia lindo 💖",
                "Tchau tchau! Qualquer coisa é só mandar mensagem, tá? 😊",
            ],
            "fora_contexto": [
                "Haha, sobre isso eu não sei te ajudar não 😅 Mas se quiser saber sobre nossos serviços ou marcar um horário, é comigo mesmo!",
                "Essa eu não sei responder não, mas posso te ajudar com agendamentos e informações da esmalteria! 💅",
            ],
            "menu": [
                (
                    "Oi! Posso te ajudar com algumas coisas 😊\n\n"
                    "Se quiser ver nossos serviços e preços, me fala **serviços**\n"
                    "Quer marcar um horário? É só dizer **agendar**\n"
                    "E se já tem conta, pode fazer **login** pra eu te reconhecer!"
                )
            ],
        }

    def adicionar_ao_historico(self, cliente_id, mensagem, resposta):
        if cliente_id not in self.historico_conversas:
            self.historico_conversas[cliente_id] = []
        self.historico_conversas[cliente_id].append({
            'mensagem':  mensagem,
            'resposta':  resposta,
            'timestamp': datetime.datetime.now().isoformat(),
        })

    def gerar_resposta(self, mensagem, contexto=None, cliente=None):
        cliente_id = cliente['id'] if cliente else "anonimo"

        # 1. Respostas predefinidas explícitas (saudação, agradecimento, etc.)
        if contexto and contexto in self.respostas_predefinidas:
            resp = random.choice(self.respostas_predefinidas[contexto])
            self.adicionar_ao_historico(cliente_id, mensagem, resp)
            return resp

        # 2. Gemini — conversa natural com contexto e limites
        if GEMINI_DISPONIVEL and gemini_client:
            try:
                historico_raw = self.historico_conversas.get(cliente_id, [])
                contents = []
                for troca in historico_raw[-10:]:
                    contents.append(types.Content(role="user",  parts=[types.Part(text=troca["mensagem"])]))
                    contents.append(types.Content(role="model", parts=[types.Part(text=troca["resposta"])]))
                contents.append(types.Content(role="user", parts=[types.Part(text=mensagem)]))

                response = gemini_client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                    ),
                )
                resp = response.text.strip()
                self.adicionar_ao_historico(cliente_id, mensagem, resp)
                return resp
            except Exception as e:
                logger.error(f"Erro no Gemini: {e}")

        # 3. Fallback — respostas predefinidas se o Gemini falhar
        resp = random.choice(self.respostas_predefinidas["menu"])
        self.adicionar_ao_historico(cliente_id, mensagem, resp)
        return resp


assistente_ia = AssistenteIA()

# ---------------------------------------------------------------------------
# FUNÇÕES DE NEGÓCIO E BANCO DE DADOS
# ---------------------------------------------------------------------------
def validar_email(email):
    return re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email) is not None

def validar_celular(celular):
    return re.match(r'^(\+55)?\s*\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}$', re.sub(r'\s', '', celular)) is not None

def normalizar_celular(celular):
    return re.sub(r'[^0-9]', '', celular)

def calcular_duracao_servico(nome):
    mapa = {"manicure": 45, "pedicure": 60, "esmaltação em gel": 60, "alongamento": 120}
    for k, v in mapa.items():
        if k in nome.lower():
            return v
    return 60

def gerar_datas_disponiveis():
    hoje = datetime.datetime.now()
    return [
        (hoje + datetime.timedelta(days=i)).strftime("%d/%m/%Y")
        for i in range(14)
        if (hoje + datetime.timedelta(days=i)).weekday() in CONFIG_NEGOCIO['dias_trabalho']
    ]

def gerar_horarios_disponiveis(data, manicure, servico):
    # Simplificado — pode ser expandido para consultar horários ocupados no Supabase
    return ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"]

# ---------------------------------------------------------------------------
# COMPREENSÃO FLEXÍVEL — apelidos, erros de digitação, fuzzy match
# ---------------------------------------------------------------------------
APELIDOS_SERVICO = {
    'mao': 'manicure', 'mão': 'manicure', 'fazer a mao': 'manicure',
    'faze a mao': 'manicure', 'fazê a mão': 'manicure',
    'unha da mao': 'manicure', 'unhia': 'manicure', 'unhas mao': 'manicure',
    'mani': 'manicure', 'manicuri': 'manicure', 'maniqure': 'manicure',
    'pe': 'pedicure', 'pé': 'pedicure', 'fazer o pe': 'pedicure',
    'faze o pe': 'pedicure', 'unha do pe': 'pedicure', 'pediqure': 'pedicure',
    'pedi': 'pedicure', 'pes': 'pedicure', 'pés': 'pedicure',
    'spa': 'spa dos pés', 'spa pe': 'spa dos pés', 'spa pes': 'spa dos pés',
    'relaxar': 'spa dos pés', 'hidratacao': 'spa dos pés',
    'gel': 'esmaltação em gel', 'esmalte gel': 'esmaltação em gel',
    'gelzinho': 'esmaltação em gel', 'esmalte': 'esmaltação em gel',
    'alongar': 'alongamento', 'alonga': 'alongamento', 'alongar unha': 'alongamento',
    'fibra': 'fibra de vidro', 'fibra vidro': 'fibra de vidro',
    'francesa': 'francesinha', 'franceza': 'francesinha', 'francesina': 'francesinha',
    'decorar': 'decoração', 'arte': 'decoração', 'nail art': 'decoração',
    'desenho': 'decoração', 'decoracao': 'decoração',
}

def encontrar_servico_por_texto(texto, servicos):
    """Encontra serviço por nome, apelido ou fuzzy match."""
    texto_lower = texto.lower().strip()
    # 1. Apelido direto
    if texto_lower in APELIDOS_SERVICO:
        alvo = APELIDOS_SERVICO[texto_lower]
        for s in servicos:
            if alvo in s['nome'].lower():
                return s
    # 2. Match parcial no nome
    for s in servicos:
        if texto_lower in s['nome'].lower() or s['nome'].lower() in texto_lower:
            return s
    # 3. Fuzzy match
    nomes = [s['nome'].lower() for s in servicos]
    matches = difflib.get_close_matches(texto_lower, nomes, n=1, cutoff=0.45)
    if matches:
        for s in servicos:
            if s['nome'].lower() == matches[0]:
                return s
    return None

def encontrar_manicure_por_texto(texto, manicures):
    """Encontra profissional por nome ou fuzzy match."""
    texto_lower = texto.lower().strip()
    for m in manicures:
        if texto_lower in m['nome'].lower() or m['nome'].lower() in texto_lower:
            return m
    nomes = [m['nome'].lower() for m in manicures]
    matches = difflib.get_close_matches(texto_lower, nomes, n=1, cutoff=0.45)
    if matches:
        for m in manicures:
            if m['nome'].lower() == matches[0]:
                return m
    return None

def gerar_pix_copia_cola(valor, nome_servico):
    """Gera um código PIX copia-e-cola simulado."""
    # Código EMV simulado para demonstração
    chave = "pix@linoesmalteria.com.br"
    valor_str = f"{valor:.2f}"
    return (
        f"00020126580014br.gov.bcb.pix0136{chave}"
        f"5204000053039865404{valor_str}5802BR"
        f"5925LINO ESMALTERIA LTDA6009SAO PAULO"
        f"62070503***6304A1B2"
    )

def obter_servicos():
    if SUPABASE_DISPONIVEL:
        return supabase.table('servicos').select('*').eq('ativo', True).execute().data
    return [
        {'id': 1, 'categoria': "Mãos",  'nome': "Manicure",    'preco': 30.0},
        {'id': 2, 'categoria': "Unhas", 'nome': "Alongamento", 'preco': 120.0},
        {'id': 3, 'categoria': "Pés",   'nome': "Pedicure",    'preco': 40.0},
    ]

def obter_manicures():
    if SUPABASE_DISPONIVEL:
        return supabase.table('manicures').select('*').eq('ativo', True).execute().data
    return [
        {'id': 1, 'nome': "Helena", 'especialidades': ['Manicure', 'Pedicure']},
        {'id': 2, 'nome': "Joana",  'especialidades': ['Alongamento', 'Manicure']},
    ]

def buscar_cliente_por_contato(contato):
    """Busca cliente por e-mail ou celular."""
    contato = contato.strip()
    if contato in ("demo@linoesmalteria.com", "11999999999"):
        return {'id': 1, 'nome': 'Maria Silva', 'email': 'demo@linoesmalteria.com', 'celular': '11999999999'}
    if SUPABASE_DISPONIVEL:
        if validar_email(contato):
            res = supabase.table('clientes').select('*').eq('email', contato).eq('ativo', True).execute()
        else:
            celular_limpo = normalizar_celular(contato)
            res = supabase.table('clientes').select('*').eq('celular', celular_limpo).eq('ativo', True).execute()
        if res.data:
            return res.data[0]
    return None

# ---------------------------------------------------------------------------
# MOTOR DE DIÁLOGO E SESSÕES
# ---------------------------------------------------------------------------
class SessaoCliente:
    def __init__(self, session_id):
        self.session_id       = session_id
        self.cliente          = None
        self.funcionario      = None
        self.estado_fluxo     = None
        self.dados_agendamento = {}
        self.dados_cadastro   = {}
        self.dados_admin      = {}   # dados temporários do painel admin
        self.is_admin         = False # flag para sessões de funcionário


class MotorDialogo:
    def __init__(self):
        self.sessoes = {}

    def obter_sessao(self, session_id):
        if session_id not in self.sessoes:
            self.sessoes[session_id] = SessaoCliente(session_id)
        return self.sessoes[session_id]

    def formatar_para_frontend(self, texto):
        """Formata a resposta no formato esperado pelo React (Index.tsx)."""
        return {
            "id":     int(time.time() * 1000),
            "text":   texto,
            "from":   "them",
            "time":   datetime.datetime.now().strftime("%I:%M %p"),
            "status": "delivered",
        }

    def processar_mensagem(self, session_id, mensagem):
        sessao = self.obter_sessao(session_id)
        mensagem_lower = mensagem.lower().strip()
        resposta_texto = ""

        try:
            # -------------------------------------------------------------------
            # Escape universal — cancela qualquer fluxo ativo
            # -------------------------------------------------------------------
            if mensagem_lower in ['cancelar', 'cancel', 'voltar', 'sair']:
                if sessao.estado_fluxo:
                    sessao.estado_fluxo = None
                    sessao.dados_agendamento = {}
                    sessao.dados_cadastro = {}
                    return self.formatar_para_frontend(
                        "Tá bom, sem problema! Cancelei aqui 😊\n\n"
                        "Quando quiser, é só me chamar de novo! Posso te mostrar nossos serviços, "
                        "marcar um horário ou te ajudar com sua conta."
                    )

            # -------------------------------------------------------------------
            # Roteamento por estado — fluxo guiado (sem IA no meio dos fluxos)
            # -------------------------------------------------------------------
            if sessao.estado_fluxo == "login_contato":
                resposta_texto = self._processar_login(sessao, mensagem)

            elif sessao.estado_fluxo == "cadastro_nome":
                resposta_texto = self._proc_cadastro_nome(sessao, mensagem)

            elif sessao.estado_fluxo == "cadastro_email":
                resposta_texto = self._proc_cadastro_email(sessao, mensagem)

            elif sessao.estado_fluxo == "cadastro_celular":
                resposta_texto = self._proc_cadastro_celular(sessao, mensagem)

            elif sessao.estado_fluxo == "cadastro_confirmacao":
                resposta_texto = self._proc_cadastro_confirmacao(sessao, mensagem)

            elif sessao.estado_fluxo == "agendamento_data":
                resposta_texto = self._proc_agendamento_data(sessao, mensagem)

            elif sessao.estado_fluxo == "agendamento_servico":
                resposta_texto = self._proc_agendamento_servico(sessao, mensagem)

            elif sessao.estado_fluxo == "agendamento_manicure":
                resposta_texto = self._proc_agendamento_manicure(sessao, mensagem)

            elif sessao.estado_fluxo == "agendamento_horario":
                resposta_texto = self._proc_agendamento_horario(sessao, mensagem)

            elif sessao.estado_fluxo == "agendamento_confirmacao":
                resposta_texto = self._proc_agendamento_confirmacao(sessao, mensagem)

            elif sessao.estado_fluxo == "agendamento_pagamento":
                resposta_texto = self._proc_agendamento_pagamento(sessao, mensagem)

            # --- FLUXOS DO PAINEL ADMIN ---
            elif sessao.estado_fluxo == "admin_menu":
                resposta_texto = self._proc_admin_menu(sessao, mensagem)

            elif sessao.estado_fluxo == "admin_confirmar_sinal":
                resposta_texto = self._proc_admin_confirmar_sinal(sessao, mensagem)

            elif sessao.estado_fluxo == "admin_cobrar_pendentes":
                resposta_texto = self._proc_admin_cobrar_pendentes(sessao, mensagem)

            else:
                # ---------------------------------------------------------------
                # Sem estado ativo — detecta intenção ou passa ao Gemini
                # ---------------------------------------------------------------
                if any(p in mensagem_lower for p in assistente_ia.intencoes_servicos):
                    resposta_texto = self._mostrar_servicos()

                elif any(p in mensagem_lower for p in assistente_ia.intencoes_agendamento):
                    resposta_texto = self._iniciar_agendamento(sessao)

                elif any(p in mensagem_lower for p in assistente_ia.intencoes_login):
                    resposta_texto = self._iniciar_login(sessao)

                elif any(p in mensagem_lower for p in assistente_ia.intencoes_cadastro):
                    resposta_texto = self._iniciar_cadastro(sessao)

                # Painel admin removido do chat público — acesso via /admin/login
                # elif any(p in mensagem_lower for p in assistente_ia.intencoes_admin):
                #     resposta_texto = self._iniciar_painel_admin(sessao)

                elif any(p in mensagem_lower for p in ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello']):
                    if sessao.cliente:
                        resposta_texto = assistente_ia.gerar_resposta(
                            mensagem, contexto="saudacao", cliente=sessao.cliente)
                    else:
                        resposta_texto = (
                            "Oii, tudo bem? Seja bem-vinda à Lino Esmalteria! 💖\n\n"
                            "Pra eu te atender melhor, me conta: você já tem cadastro aqui com a gente?\n\n"
                            "✅ Se sim, me fala **login**\n"
                            "🆕 Se é sua primeira vez, me fala **cadastrar**\n\n"
                            "Ou se quiser só dar uma olhadinha, posso te mostrar nossos **serviços** 💅"
                        )

                elif any(p in mensagem_lower for p in ['obrigad']):
                    resposta_texto = assistente_ia.gerar_resposta(
                        mensagem, contexto="agradecimento", cliente=sessao.cliente)

                elif any(p in mensagem_lower for p in ['tchau', 'bye', 'até logo']):
                    resposta_texto = assistente_ia.gerar_resposta(
                        mensagem, contexto="despedida", cliente=sessao.cliente)

                elif mensagem_lower in ['sim', 's', 'não', 'nao', 'n', 'no']:
                    # Respostas soltas de sim/não fora de fluxo
                    resposta_texto = (
                        "Hmm, não entendi muito bem 😅\n\n"
                        "Me fala o que você precisa — posso te ajudar com **serviços**, **agendar** um horário, "
                        "ou fazer seu **cadastro**! 💅"
                    )

                else:
                    # Gemini responde livremente dentro dos limites do system prompt
                    resposta_texto = assistente_ia.gerar_resposta(
                        mensagem, cliente=sessao.cliente)

        except Exception as e:
            logger.error(f"Erro ao processar mensagem: {e}")
            resposta_texto = "Xiii, deu um probleminha aqui do meu lado 😅 Pode tentar de novo, por favor?"

        return self.formatar_para_frontend(resposta_texto)

    # ---------------------------------------------------------------------------
    # LÓGICA DE FLUXO
    # ---------------------------------------------------------------------------
    def _mostrar_servicos(self):
        servicos = obter_servicos()
        resp = "Olha só o que a gente oferece 💅\n\n"
        for s in servicos:
            resp += f"• {s['nome']} — R$ {s['preco']:.2f}\n"
        resp += "\nSe interessou por algum? É só me falar **agendar** que eu te ajudo a marcar! 😉"
        return resp

    # --- LOGIN ---
    def _iniciar_login(self, sessao):
        if sessao.cliente:
            return f"Você já tá logada, *{sessao.cliente['nome']}*! 😊 Se quiser marcar um horário, me fala **agendar**."
        sessao.estado_fluxo = "login_contato"
        return (
            "Claro, vou te identificar! Me passa seu **e-mail** ou **celular** que eu te encontro aqui no sistema 😉"
        )

    def _processar_login(self, sessao, mensagem):
        contato = mensagem.strip()
        if not validar_email(contato) and not validar_celular(contato):
            return "Hmm, não consegui entender 😅 Me manda um e-mail válido ou seu celular com DDD, tipo 11999999999."
        cliente = buscar_cliente_por_contato(contato)
        if cliente:
            sessao.cliente = cliente
            sessao.estado_fluxo = None
            return (
                f"Achei! Oi, *{cliente['nome']}*! Que bom te ver de volta 😊\n"
                f"Me fala o que você precisa — posso te mostrar nossos **serviços** ou te ajudar a **agendar** um horário!"
            )
        # Não encontrou — oferece cadastro diretamente
        sessao.estado_fluxo = None
        return (
            "Hmm, não encontrei ninguém com esse contato 😔\n\n"
            "Mas não se preocupa! Posso te cadastrar rapidinho agora mesmo 😊\n"
            "É só me falar **cadastrar** que a gente resolve em 1 minutinho!"
        )

    # --- AGENDAMENTO: PASSO 1 — Data ---
    def _iniciar_agendamento(self, sessao):
        if not sessao.cliente:
            return (
                "Pra eu marcar seu horário, preciso te conhecer primeiro! 😊\n\n"
                "Você prefere entrar na sua conta ou criar um perfil rapidinho?\n\n"
                "✅ Me fala **login** se já tem conta\n"
                "🆕 Ou **cadastrar** pra criar agora — leva menos de 1 minuto!"
            )
        datas = gerar_datas_disponiveis()[:5]
        sessao.dados_agendamento = {'lista_datas': datas}
        sessao.estado_fluxo = "agendamento_data"
        resp = "Ótimo, vamos marcar! Qual dessas datas fica melhor pra você? 📅\n\n"
        for i, d in enumerate(datas, 1):
            resp += f"{i} - {d}\n"
        resp += "\nÉ só me mandar o número da opção!"
        return resp

    # --- AGENDAMENTO: PASSO 2 — Serviço ---
    def _proc_agendamento_data(self, sessao, mensagem):
        datas = sessao.dados_agendamento.get('lista_datas', [])
        if mensagem.isdigit() and 1 <= int(mensagem) <= len(datas):
            sessao.dados_agendamento['data'] = datas[int(mensagem) - 1]
            sessao.estado_fluxo = "agendamento_servico"
            servs = obter_servicos()
            sessao.dados_agendamento['lista_servicos'] = servs
            resp = f"Perfeito, anotei dia *{sessao.dados_agendamento['data']}*! 📅\n\nAgora me fala, qual serviço você quer fazer?\n\n"
            for i, s in enumerate(servs, 1):
                resp += f"{i} - {s['nome']} (R$ {s['preco']:.2f})\n"
            return resp
        return "Não entendi 😅 Me manda só o número da data que você prefere, tá?"

    # --- AGENDAMENTO: PASSO 2 — Serviço (aceita número OU texto/apelido) ---
    def _proc_agendamento_servico(self, sessao, mensagem):
        servs = sessao.dados_agendamento.get('lista_servicos', [])
        servico_escolhido = None
        msg = mensagem.strip()

        # Tenta por número
        if msg.isdigit() and 1 <= int(msg) <= len(servs):
            servico_escolhido = servs[int(msg) - 1]
        else:
            # Tenta por texto / fuzzy match
            servico_escolhido = encontrar_servico_por_texto(msg, servs)

        if servico_escolhido:
            sessao.dados_agendamento['servico'] = servico_escolhido
            sessao.estado_fluxo = "agendamento_manicure"
            manicures = obter_manicures()
            sessao.dados_agendamento['lista_manicures'] = manicures
            resp = f"Ótima escolha, *{servico_escolhido['nome']}*! 💅\n\nAgora me fala, com qual das nossas profissionais você gostaria de ser atendida?\n\n"
            for i, m in enumerate(manicures, 1):
                resp += f"{i} - {m['nome']}\n"
            resp += "\nPode me mandar o número ou o nome dela 😊"
            return resp
        return (
            "Hmm, não encontrei esse serviço 🤔\n\n"
            "Pode me mandar o **número** da lista ou o **nome** do serviço que você quer?\n"
            "Aceito até apelido, tipo \"mão\", \"pé\", \"gel\"... 😉"
        )

    # --- AGENDAMENTO: PASSO 3 — Profissional (aceita número OU nome) ---
    def _proc_agendamento_manicure(self, sessao, mensagem):
        manicures = sessao.dados_agendamento.get('lista_manicures', [])
        manicure_escolhida = None
        msg = mensagem.strip()

        if msg.isdigit() and 1 <= int(msg) <= len(manicures):
            manicure_escolhida = manicures[int(msg) - 1]
        else:
            manicure_escolhida = encontrar_manicure_por_texto(msg, manicures)

        if manicure_escolhida:
            sessao.dados_agendamento['manicure'] = manicure_escolhida
            sessao.estado_fluxo = "agendamento_horario"
            horarios = gerar_horarios_disponiveis(
                sessao.dados_agendamento['data'],
                manicure_escolhida,
                sessao.dados_agendamento['servico'],
            )
            sessao.dados_agendamento['lista_horarios'] = horarios
            resp = f"Boa, a *{manicure_escolhida['nome']}* é maravilhosa! 😊\n\nAgora escolhe o melhor horário pra você:\n\n"
            for i, h in enumerate(horarios, 1):
                resp += f"{i} - {h}\n"
            return resp
        return "Não encontrei essa profissional 😅 Me manda o número ou o nome dela, por favor!"

    # --- AGENDAMENTO: PASSO 4 — Horário ---
    def _proc_agendamento_horario(self, sessao, mensagem):
        horarios = sessao.dados_agendamento.get('lista_horarios', [])
        if mensagem.strip().isdigit() and 1 <= int(mensagem.strip()) <= len(horarios):
            sessao.dados_agendamento['horario'] = horarios[int(mensagem.strip()) - 1]
            sessao.estado_fluxo = "agendamento_confirmacao"
            d = sessao.dados_agendamento
            preco = d['servico']['preco']
            sinal = preco * 0.4
            sessao.dados_agendamento['sinal'] = sinal
            return (
                f"Perfeito! Olha o resumo do seu agendamento 😊\n\n"
                f"📅 Dia: *{d['data']}*\n"
                f"🕐 Horário: *{d['horario']}*\n"
                f"💅 Serviço: *{d['servico']['nome']}* (R$ {preco:.2f})\n"
                f"👩 Profissional: *{d['manicure']['nome']}*\n\n"
                f"💰 Para garantir seu horário, pedimos um sinal de 40% — **R$ {sinal:.2f}**\n\n"
                f"Tá tudo certo? Me fala **sim** pra continuar com o pagamento ou **não** se quiser mudar algo!"
            )
        return "Ops, esse número não tá na lista 😅 Me manda o número do horário que você prefere!"

    # --- AGENDAMENTO: PASSO 5 — Confirmação → Gera PIX ---
    def _proc_agendamento_confirmacao(self, sessao, mensagem):
        if mensagem.strip().lower() in ['sim', 's', 'yes', 'confirmar']:
            d = sessao.dados_agendamento
            sinal = d.get('sinal', d['servico']['preco'] * 0.4)
            pix_code = gerar_pix_copia_cola(sinal, d['servico']['nome'])
            sessao.dados_agendamento['pix_code'] = pix_code
            sessao.estado_fluxo = "agendamento_pagamento"
            return (
                f"Ótimo! Para garantir seu horário, é só fazer o PIX do sinal de **R$ {sinal:.2f}** 💳\n\n"
                f"Aqui tá o QR Code e o código pra copiar:\n\n"
                f"{{{{PIX:{pix_code}}}}}\n\n"
                f"Depois que fizer o pagamento, me fala **pago** que eu confirmo tudo pra você! 😊\n\n"
                f"Se quiser cancelar, é só falar **cancelar**."
            )
        else:
            sessao.dados_agendamento = {}
            sessao.estado_fluxo = None
            return "Sem problema, cancelei! Quando quiser tentar de novo, é só me falar **agendar** 💖"

    # --- AGENDAMENTO: PASSO 6 — Aguarda pagamento → Salva ---
    def _proc_agendamento_pagamento(self, sessao, mensagem):
        msg = mensagem.strip().lower()
        if msg in ['pago', 'paguei', 'fiz o pix', 'pix feito', 'transferi', 'pronto', 'feito', 'já paguei', 'ja paguei']:
            resultado = self._salvar_agendamento(sessao)
            sessao.dados_agendamento = {}
            sessao.estado_fluxo = None
            return resultado
        elif msg in ['cancelar', 'cancel', 'voltar', 'desistir']:
            sessao.dados_agendamento = {}
            sessao.estado_fluxo = None
            return "Tudo bem, cancelei o agendamento! Quando quiser tentar de novo, é só me chamar 💖"
        else:
            d = sessao.dados_agendamento
            sinal = d.get('sinal', 0)
            return (
                f"Estou aguardando a confirmação do seu PIX de **R$ {sinal:.2f}** 😊\n\n"
                f"Quando fizer o pagamento, me fala **pago** que eu confirmo tudo!\n"
                f"Se precisar do código de novo, aqui está:\n\n"
                f"{{{{PIX:{d.get('pix_code', '')}}}}}"
            )

    def _salvar_agendamento(self, sessao):
        """Salva o agendamento confirmado no Supabase com o sinal."""
        d = sessao.dados_agendamento
        sinal = d.get('sinal', d['servico']['preco'] * 0.4)
        try:
            if SUPABASE_DISPONIVEL:
                supabase.table('agendamentos').insert({
                    'cliente_id':  sessao.cliente['id'],
                    'servico_id':  d['servico'].get('id'),
                    'manicure_id': d['manicure'].get('id'),
                    'data':        d['data'],
                    'horario':     d['horario'],
                    'status':      'confirmado',
                    'sinal_pago':  sinal,
                    'criado_em':   datetime.datetime.now().isoformat(),
                }).execute()
            return (
                f"Pagamento recebido e agendamento confirmado! ✨\n\n"
                f"📅 *{d['data']}* às *{d['horario']}*\n"
                f"💅 *{d['servico']['nome']}* com a *{d['manicure']['nome']}*\n"
                f"💰 Sinal pago: R$ {sinal:.2f}\n\n"
                f"Vamos te esperar, viu? Qualquer coisa é só chamar! 💖"
            )
        except Exception as e:
            logger.error(f"Erro ao salvar agendamento: {e}")
            return "Poxa, tive um problema pra salvar o agendamento 😔 Tenta de novo ou entra em contato com a gente por telefone, tá?"


    # -----------------------------------------------------------------------
    # FLUXO DE CADASTRO
    # -----------------------------------------------------------------------
    def _iniciar_cadastro(self, sessao):
        """Inicia o fluxo de cadastro de novo cliente."""
        if sessao.cliente:
            return f"Você já tem conta, *{sessao.cliente['nome']}*! 😊 Se quiser marcar um horário, me fala **agendar**."
        sessao.dados_cadastro = {}
        sessao.estado_fluxo = "cadastro_nome"
        return (
            "Que legal que você quer fazer parte da Lino Esmalteria! 🎉\n\n"
            "É rapidinho, vou te pedir só algumas informações, tá?\n\n"
            "Pra começar, qual é o seu **nome completo**?"
        )

    def _proc_cadastro_nome(self, sessao, mensagem):
        nome = mensagem.strip()
        if len(nome) < 3:
            return "Hmm, acho que faltou algo 😅 Me manda seu nome completo, por favor!"
        sessao.dados_cadastro['nome'] = nome
        sessao.estado_fluxo = "cadastro_email"
        return f"Muito prazer, *{nome}*! Que bom te conhecer 😊\n\nAgora me passa seu **e-mail** pra eu salvar aqui, por favor?"

    def _proc_cadastro_email(self, sessao, mensagem):
        email = mensagem.strip().lower()
        if not validar_email(email):
            return "Esse e-mail não parece certo 😅 Tenta de novo, tipo nome@email.com"
        # Verifica duplicidade
        if SUPABASE_DISPONIVEL:
            try:
                res = supabase.table('clientes').select('id').eq('email', email).execute()
                if res.data:
                    sessao.estado_fluxo = None
                    return "Epa, esse e-mail já tá cadastrado! 😊 Me fala **login** que eu te conecto."
            except Exception as e:
                logger.error(f"Erro ao verificar email: {e}")
        sessao.dados_cadastro['email'] = email
        sessao.estado_fluxo = "cadastro_celular"
        return (
            "Perfeito, anotei! ✅\n\n"
            "Agora, se puder me passar seu **celular** com DDD fica ótimo! (tipo 11999999999)\n\n"
            "Se preferir não informar agora, sem problema — é só falar **pular** 😉"
        )

    def _proc_cadastro_celular(self, sessao, mensagem):
        if mensagem.strip().lower() == "pular":
            sessao.dados_cadastro['celular'] = None
        else:
            raw = mensagem.strip()
            if not validar_celular(raw):
                return "Hmm, esse número não parece certo 😅 Manda só os números com DDD (tipo 11999999999) ou fala **pular**."
            celular = normalizar_celular(raw)
            # Verifica duplicidade
            if SUPABASE_DISPONIVEL:
                try:
                    res = supabase.table('clientes').select('id').eq('celular', celular).execute()
                    if res.data:
                        return "Esse celular já tá vinculado a outra conta! Tenta outro número ou fala **pular** 😊"
                except Exception as e:
                    logger.error(f"Erro ao verificar celular: {e}")
            sessao.dados_cadastro['celular'] = celular

        sessao.estado_fluxo = "cadastro_confirmacao"
        d = sessao.dados_cadastro
        celular_exib = d.get('celular') or "não informado"
        return (
            f"Ótimo, deixa eu conferir se tá tudo certinho 😊\n\n"
            f"👤 Nome: {d['nome']}\n"
            f"📧 E-mail: {d['email']}\n"
            f"📱 Celular: {celular_exib}\n\n"
            "Tá tudo certo? Me fala **sim** pra confirmar ou **não** se quiser mudar algo!"
        )

    def _proc_cadastro_confirmacao(self, sessao, mensagem):
        if mensagem.strip().lower() in ['sim', 's', 'yes']:
            resultado = self._salvar_cadastro(sessao)
            sessao.dados_cadastro = {}
            sessao.estado_fluxo = None
            return resultado
        else:
            sessao.dados_cadastro = {}
            sessao.estado_fluxo = None
            return "Sem problema, cancelei! Se mudar de ideia, é só me falar **cadastrar** de novo 😊"

    def _salvar_cadastro(self, sessao):
        """Salva o novo cliente no Supabase e faz login automático."""
        d = sessao.dados_cadastro
        dados_insert = {
            'nome':    d['nome'],
            'email':   d['email'],
            'ativo':   True,
        }
        if d.get('celular'):
            dados_insert['celular'] = d['celular']
        try:
            if SUPABASE_DISPONIVEL:
                logger.info(f"Tentando cadastrar cliente: {dados_insert}")
                res = supabase.table('clientes').insert(dados_insert).execute()
                logger.info(f"Resposta do Supabase: {res}")
                if res.data:
                    sessao.cliente = res.data[0]
                    logger.info(f"Novo cliente cadastrado: {res.data[0].get('id')} — {d['nome']}")
                else:
                    logger.warning(f"Insert retornou sem dados: {res}")
                    sessao.cliente = {'id': 0, 'nome': d['nome'], 'email': d['email'], 'celular': d.get('celular')}
            else:
                # Modo demo — simula login sem persistência
                sessao.cliente = {'id': 999, 'nome': d['nome'], 'email': d['email'], 'celular': d.get('celular')}
            return (
                f"Pronto, sua conta foi criada com sucesso! Bem-vinda à Lino Esmalteria, *{d['nome']}*! 🎉💖\n\n"
                f"Você já tá logada e pronta pra usar!\n\n"
                f"💅 Quer ver nossos **serviços**?\n"
                f"📅 Ou já quer **agendar** um horário?\n\n"
                f"É só me falar! 😊"
            )
        except Exception as e:
            logger.error(f"Erro ao salvar cadastro: {e}", exc_info=True)
            return (
                "Poxa, tive um probleminha técnico aqui 😔\n\n"
                "Pode tentar de novo? É só me falar **cadastrar** que a gente recomeça rapidinho!"
            )


    # -----------------------------------------------------------------------
    # PAINEL ADMINISTRATIVO VIA CHAT
    # -----------------------------------------------------------------------
    def _obter_agendamentos_do_dia(self, data_str=None):
        """
        Busca agendamentos do dia no Supabase com dados completos
        (nome do cliente, serviço, preço, manicure).
        Retorna lista de dicts enriquecidos ou lista demo.
        """
        if data_str is None:
            data_str = datetime.datetime.now().strftime("%d/%m/%Y")

        if SUPABASE_DISPONIVEL:
            try:
                res = supabase.table('agendamentos') \
                    .select('*, clientes(nome, celular), servicos(nome, preco), manicures(nome)') \
                    .eq('data', data_str) \
                    .neq('status', 'cancelado') \
                    .order('horario') \
                    .execute()

                agendamentos = []
                for a in (res.data or []):
                    agendamentos.append({
                        'id':            a['id'],
                        'horario':       a.get('horario', '--:--'),
                        'cliente_nome':  a.get('clientes', {}).get('nome', 'N/A') if a.get('clientes') else 'N/A',
                        'cliente_cel':   a.get('clientes', {}).get('celular', '') if a.get('clientes') else '',
                        'servico_nome':  a.get('servicos', {}).get('nome', 'N/A') if a.get('servicos') else 'N/A',
                        'servico_preco': a.get('servicos', {}).get('preco', 0) if a.get('servicos') else 0,
                        'manicure_nome': a.get('manicures', {}).get('nome', 'N/A') if a.get('manicures') else 'N/A',
                        'status':        a.get('status', 'pendente'),
                        'sinal_pago':    a.get('sinal_pago', 0),
                    })
                return agendamentos, data_str
            except Exception as e:
                logger.error(f"Erro ao buscar agendamentos do dia: {e}")
                return [], data_str
        else:
            # Modo demo — dados simulados
            return [
                {'id': 1, 'horario': '09:00', 'cliente_nome': 'Maria Silva', 'cliente_cel': '11999999999',
                 'servico_nome': 'Manicure', 'servico_preco': 30.0, 'manicure_nome': 'Helena',
                 'status': 'confirmado', 'sinal_pago': 12.0},
                {'id': 2, 'horario': '10:30', 'cliente_nome': 'Ana Souza', 'cliente_cel': '11988888888',
                 'servico_nome': 'Alongamento', 'servico_preco': 120.0, 'manicure_nome': 'Joana',
                 'status': 'pendente', 'sinal_pago': 0},
                {'id': 3, 'horario': '14:00', 'cliente_nome': 'Carla Lima', 'cliente_cel': '11977777777',
                 'servico_nome': 'Pedicure', 'servico_preco': 40.0, 'manicure_nome': 'Helena',
                 'status': 'confirmado', 'sinal_pago': 16.0},
            ], data_str

    def _formatar_relatorio_diario(self, agendamentos, data_str):
        """
        Formata a lista de agendamentos em uma mensagem estruturada estilo
        WhatsApp com KPIs, agenda cronológica e menu de ações rápidas.
        """
        hoje_label = datetime.datetime.now().strftime("%d/%m/%Y")
        if data_str == hoje_label:
            titulo_data = f"*📋 Painel do Dia — {data_str}*"
        else:
            titulo_data = f"*📋 Painel — {data_str}*"

        if not agendamentos:
            return (
                f"{titulo_data}\n\n"
                "Nenhum agendamento encontrado para essa data 📭\n\n"
                "Dia tranquilo! Que tal aproveitar para organizar o estoque? 😉\n\n"
                "─────────────────\n"
                "1️⃣ Atualizar Agenda\n\n"
                "_Digite o número da ação desejada._"
            )

        # --- Calcular KPIs ---
        faturamento = sum(a['servico_preco'] for a in agendamentos)
        confirmados = [a for a in agendamentos if a['sinal_pago'] and a['sinal_pago'] > 0]
        pendentes   = [a for a in agendamentos if not a['sinal_pago'] or a['sinal_pago'] == 0]

        # --- Bloco de Resumo ---
        bloco_resumo = (
            f"{titulo_data}\n\n"
            f"💰 *Faturamento Previsto:* R$ {faturamento:,.2f}\n"
            f"🟢 *Confirmados (Sinal Pago):* {len(confirmados)}\n"
            f"🟠 *Pendentes (Aguardando Sinal):* {len(pendentes)}\n"
            f"👥 *Total de Clientes:* {len(agendamentos)}"
        )

        # --- Lista da Agenda ---
        bloco_agenda = "\n\n─────────────────\n*🗓️ Agenda do Dia*\n─────────────────\n"
        for idx, a in enumerate(agendamentos, 1):
            status_emoji = "🟢" if (a['sinal_pago'] and a['sinal_pago'] > 0) else "🟠"
            status_label = "Confirmado" if (a['sinal_pago'] and a['sinal_pago'] > 0) else "Aguardando Sinal"
            bloco_agenda += (
                f"\n*{a['horario']}* — *{a['cliente_nome']}*\n"
                f"   💅 {a['servico_nome']} — R$ {a['servico_preco']:.2f}\n"
                f"   👩 Profissional: {a['manicure_nome']}\n"
                f"   {status_emoji} _{status_label}_\n"
            )

        # --- Menu de Ações Rápidas ---
        bloco_acoes = (
            "\n─────────────────\n"
            "*⚡ Ações Rápidas*\n"
            "─────────────────\n\n"
            "1️⃣ Confirmar Sinal\n"
            "2️⃣ Cobrar Pendentes\n"
            "3️⃣ Atualizar Agenda\n\n"
            "_Digite o número da ação desejada._"
        )

        return bloco_resumo + bloco_agenda + bloco_acoes

    def _iniciar_painel_admin(self, sessao):
        """Gera o relatório diário e ativa o menu de ações."""
        agendamentos, data_str = self._obter_agendamentos_do_dia()
        sessao.dados_admin = {
            'agendamentos': agendamentos,
            'data': data_str,
        }
        sessao.estado_fluxo = "admin_menu"
        return self._formatar_relatorio_diario(agendamentos, data_str)

    def _proc_admin_menu(self, sessao, mensagem):
        """Processa a escolha do menu de ações rápidas."""
        msg = mensagem.strip()

        if msg == '1' or 'confirmar sinal' in msg.lower():
            return self._admin_iniciar_confirmar_sinal(sessao)
        elif msg == '2' or 'cobrar' in msg.lower():
            return self._admin_iniciar_cobrar_pendentes(sessao)
        elif msg == '3' or 'atualizar' in msg.lower():
            return self._admin_atualizar_agenda(sessao)
        else:
            sessao.estado_fluxo = None
            sessao.dados_admin = {}
            return (
                "Ok, saí do painel! 😊\n\n"
                "Se precisar ver a agenda de novo, é só me falar *agenda* a qualquer momento."
            )

    # --- AÇÃO 1: Confirmar Sinal ---
    def _admin_iniciar_confirmar_sinal(self, sessao):
        """Mostra a lista de pendentes para confirmar sinal."""
        agendamentos = sessao.dados_admin.get('agendamentos', [])
        pendentes = [a for a in agendamentos if not a['sinal_pago'] or a['sinal_pago'] == 0]

        if not pendentes:
            sessao.estado_fluxo = "admin_menu"
            return (
                "✅ *Ótima notícia!* Todos os agendamentos do dia já têm sinal confirmado!\n\n"
                "─────────────────\n"
                "1️⃣ Confirmar Sinal\n"
                "2️⃣ Cobrar Pendentes\n"
                "3️⃣ Atualizar Agenda\n\n"
                "_Digite o número da ação ou qualquer coisa para sair do painel._"
            )

        sessao.dados_admin['pendentes'] = pendentes
        sessao.estado_fluxo = "admin_confirmar_sinal"

        resp = "*💳 Confirmar Sinal — Selecione o agendamento:*\n\n"
        for i, a in enumerate(pendentes, 1):
            resp += f"{i} — *{a['horario']}* | *{a['cliente_nome']}* | {a['servico_nome']} (R$ {a['servico_preco']:.2f})\n"
        resp += "\n_Digite o número do agendamento ou *voltar* para retornar ao painel._"
        return resp

    def _proc_admin_confirmar_sinal(self, sessao, mensagem):
        """Processa a confirmação de sinal de um agendamento pendente."""
        msg = mensagem.strip().lower()
        if msg in ['voltar', 'cancelar', 'sair']:
            sessao.estado_fluxo = "admin_menu"
            return self._formatar_relatorio_diario(
                sessao.dados_admin.get('agendamentos', []),
                sessao.dados_admin.get('data', '')
            )

        pendentes = sessao.dados_admin.get('pendentes', [])
        if mensagem.strip().isdigit():
            idx = int(mensagem.strip())
            if 1 <= idx <= len(pendentes):
                agendamento = pendentes[idx - 1]
                sinal_valor = agendamento['servico_preco'] * 0.4

                # Atualizar no Supabase
                if SUPABASE_DISPONIVEL:
                    try:
                        supabase.table('agendamentos').update({
                            'sinal_pago': sinal_valor,
                            'status': 'confirmado',
                        }).eq('id', agendamento['id']).execute()
                    except Exception as e:
                        logger.error(f"Erro ao confirmar sinal: {e}")
                        return "❌ Ocorreu um erro ao salvar a confirmação. Tente novamente."

                # Atualizar dados locais da sessão
                for a in sessao.dados_admin.get('agendamentos', []):
                    if a['id'] == agendamento['id']:
                        a['sinal_pago'] = sinal_valor
                        a['status'] = 'confirmado'

                sessao.estado_fluxo = "admin_menu"
                return (
                    f"✅ *Sinal confirmado!*\n\n"
                    f"👤 *{agendamento['cliente_nome']}*\n"
                    f"💅 {agendamento['servico_nome']} às *{agendamento['horario']}*\n"
                    f"💰 Sinal: R$ {sinal_valor:.2f}\n\n"
                    "─────────────────\n"
                    "1️⃣ Confirmar Sinal\n"
                    "2️⃣ Cobrar Pendentes\n"
                    "3️⃣ Atualizar Agenda\n\n"
                    "_Digite o número da ação ou qualquer coisa para sair do painel._"
                )

        return "Não entendi 😅 Me manda o *número* do agendamento da lista ou *voltar* pra retornar."

    # --- AÇÃO 2: Cobrar Pendentes ---
    def _admin_iniciar_cobrar_pendentes(self, sessao):
        """Gera mensagens de cobrança para todos os pendentes."""
        agendamentos = sessao.dados_admin.get('agendamentos', [])
        pendentes = [a for a in agendamentos if not a['sinal_pago'] or a['sinal_pago'] == 0]

        if not pendentes:
            sessao.estado_fluxo = "admin_menu"
            return (
                "✅ *Nenhum pendente!* Todos os sinais já foram confirmados 🎉\n\n"
                "─────────────────\n"
                "1️⃣ Confirmar Sinal\n"
                "2️⃣ Cobrar Pendentes\n"
                "3️⃣ Atualizar Agenda\n\n"
                "_Digite o número da ação ou qualquer coisa para sair do painel._"
            )

        data_str = sessao.dados_admin.get('data', '')
        resp = "*📨 Mensagens de Cobrança Geradas:*\n\n"
        resp += "_Copie e envie cada mensagem para a cliente:_\n\n"

        for i, a in enumerate(pendentes, 1):
            sinal_valor = a['servico_preco'] * 0.4
            msg_cobranca = (
                f"Oi, *{a['cliente_nome']}*! Tudo bem? 😊\n"
                f"Passando pra lembrar do seu horário na _Lino Esmalteria_:\n\n"
                f"📅 *{data_str}* às *{a['horario']}*\n"
                f"💅 *{a['servico_nome']}*\n\n"
                f"Pra garantir seu horário, é só enviar o sinal de *R$ {sinal_valor:.2f}* via PIX 💳\n"
                f"Qualquer dúvida, estou por aqui! 💖"
            )
            resp += f"─── Cliente {i} ───\n{msg_cobranca}\n\n"

        sessao.estado_fluxo = "admin_menu"
        resp += (
            "─────────────────\n"
            "1️⃣ Confirmar Sinal\n"
            "2️⃣ Cobrar Pendentes\n"
            "3️⃣ Atualizar Agenda\n\n"
            "_Digite o número da ação ou qualquer coisa para sair do painel._"
        )
        return resp

    def _proc_admin_cobrar_pendentes(self, sessao, mensagem):
        """Fallback — redireciona de volta ao menu."""
        return self._proc_admin_menu(sessao, mensagem)

    # --- AÇÃO 3: Atualizar Agenda ---
    def _admin_atualizar_agenda(self, sessao):
        """Re-consulta o banco e gera o relatório atualizado."""
        agendamentos, data_str = self._obter_agendamentos_do_dia()
        sessao.dados_admin = {
            'agendamentos': agendamentos,
            'data': data_str,
        }
        sessao.estado_fluxo = "admin_menu"
        return self._formatar_relatorio_diario(agendamentos, data_str)


# ---------------------------------------------------------------------------
# SIMULAÇÃO (Exemplo de integração com o frontend React / Index.tsx)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    motor = MotorDialogo()

    print("--- TESTE LOCAL DO MOTOR DE DIÁLOGO ---")
    print("(Este bloco só executa ao rodar agente.py diretamente; não afeta o servidor)")
    session_id = "user_123"

    mensagens_teste = [
        "oi",
        "serviços",
        # --- Fluxo de cadastro ---
        "cadastrar",
        "João da Silva",          # nome
        "joao@email.com",         # email
        "11988887777",            # celular
        "sim",                    # confirmar cadastro
        # --- Fluxo de agendamento ---
        "agendar",
        "1",   # data
        "1",   # serviço
        "1",   # profissional
        "1",   # horário
        "sim", # confirmar agendamento
        # --- Painel Administrativo ---
        "agenda",                 # abre o painel
        "1",                      # confirmar sinal
        "voltar",                 # voltar ao painel
        "2",                      # cobrar pendentes
        "3",                      # atualizar agenda
        # --- Escape cancelar ---
        "login",
        "cancelar",
    ]

    for msg in mensagens_teste:
        print(f"\n[React User]: {msg}")
        resposta_json = motor.processar_mensagem(session_id, msg)
        print(f"[API Response]: {json.dumps(resposta_json, ensure_ascii=False, indent=2)}")