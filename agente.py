import datetime
import time
import json
import logging
import random
import re
import os
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
        self.intencoes_login      = ['login', 'entrar', 'logar', 'minha conta']
        self.intencoes_cadastro   = ['cadastrar', 'cadastro', 'criar conta', 'nova conta', 'registrar', 'me cadastrar']

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

                elif any(p in mensagem_lower for p in ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello']):
                    resposta_texto = assistente_ia.gerar_resposta(
                        mensagem, contexto="saudacao", cliente=sessao.cliente)

                elif any(p in mensagem_lower for p in ['obrigad']):
                    resposta_texto = assistente_ia.gerar_resposta(
                        mensagem, contexto="agradecimento", cliente=sessao.cliente)

                elif any(p in mensagem_lower for p in ['tchau', 'bye', 'sair', 'até logo']):
                    resposta_texto = assistente_ia.gerar_resposta(
                        mensagem, contexto="despedida", cliente=sessao.cliente)

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
        sessao.estado_fluxo = None
        return "Não encontrei ninguém com esse contato 😔 Se você ainda não tem conta, é só me falar **cadastrar** que eu te ajudo!"

    # --- AGENDAMENTO: PASSO 1 — Data ---
    def _iniciar_agendamento(self, sessao):
        if not sessao.cliente:
            return "Antes de agendar, preciso saber quem você é! Me fala **login** pra entrar na sua conta ou **cadastrar** se for sua primeira vez aqui 😊"
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

    # --- AGENDAMENTO: PASSO 3 — Profissional ---
    def _proc_agendamento_servico(self, sessao, mensagem):
        servs = sessao.dados_agendamento.get('lista_servicos', [])
        if mensagem.isdigit() and 1 <= int(mensagem) <= len(servs):
            sessao.dados_agendamento['servico'] = servs[int(mensagem) - 1]
            sessao.estado_fluxo = "agendamento_manicure"
            manicures = obter_manicures()
            sessao.dados_agendamento['lista_manicures'] = manicures
            resp = f"Ótima escolha! 💅 E com qual profissional você prefere?\n\n"
            for i, m in enumerate(manicures, 1):
                resp += f"{i} - {m['nome']}\n"
            return resp
        return "Hmm, não achei esse número 🤔 Me manda o número do serviço que você quer, por favor!"

    # --- AGENDAMENTO: PASSO 4 — Horário ---
    def _proc_agendamento_manicure(self, sessao, mensagem):
        manicures = sessao.dados_agendamento.get('lista_manicures', [])
        if mensagem.isdigit() and 1 <= int(mensagem) <= len(manicures):
            sessao.dados_agendamento['manicure'] = manicures[int(mensagem) - 1]
            sessao.estado_fluxo = "agendamento_horario"
            horarios = gerar_horarios_disponiveis(
                sessao.dados_agendamento['data'],
                sessao.dados_agendamento['manicure'],
                sessao.dados_agendamento['servico'],
            )
            sessao.dados_agendamento['lista_horarios'] = horarios
            resp = f"Boa, a {sessao.dados_agendamento['manicure']['nome']} é ótima! 😊 Agora só falta escolher o horário:\n\n"
            for i, h in enumerate(horarios, 1):
                resp += f"{i} - {h}\n"
            return resp
        return "Não achei essa opção 😅 Me manda o número da profissional, por favor!"

    # --- AGENDAMENTO: PASSO 5 — Confirmação ---
    def _proc_agendamento_horario(self, sessao, mensagem):
        horarios = sessao.dados_agendamento.get('lista_horarios', [])
        if mensagem.isdigit() and 1 <= int(mensagem) <= len(horarios):
            sessao.dados_agendamento['horario'] = horarios[int(mensagem) - 1]
            sessao.estado_fluxo = "agendamento_confirmacao"
            d = sessao.dados_agendamento
            return (
                f"Pronto, deixa eu confirmar tudo com você 😊\n\n"
                f"📅 Dia: {d['data']}\n"
                f"🕐 Às: {d['horario']}\n"
                f"💅 Serviço: {d['servico']['nome']} (R$ {d['servico']['preco']:.2f})\n"
                f"👩 Com: {d['manicure']['nome']}\n\n"
                f"Tá tudo certo? Me fala **sim** pra confirmar ou **não** se quiser mudar algo!"
            )
        return "Ops, esse número não tá na lista 😅 Me manda o número do horário que você quer!"

    # --- AGENDAMENTO: PASSO 6 — Salva no Supabase ---
    def _proc_agendamento_confirmacao(self, sessao, mensagem):
        if mensagem.strip().lower() in ['sim', 's', 'yes']:
            resultado = self._salvar_agendamento(sessao)
            sessao.dados_agendamento = {}
            sessao.estado_fluxo = None
            return resultado
        else:
            sessao.dados_agendamento = {}
            sessao.estado_fluxo = None
            return "Tudo bem, cancelei o agendamento! Quando quiser tentar de novo, é só me falar 💖"

    def _salvar_agendamento(self, sessao):
        """Salva o agendamento confirmado no Supabase."""
        d = sessao.dados_agendamento
        try:
            if SUPABASE_DISPONIVEL:
                supabase.table('agendamentos').insert({
                    'cliente_id':  sessao.cliente['id'],
                    'servico_id':  d['servico'].get('id'),
                    'manicure_id': d['manicure'].get('id'),
                    'data':        d['data'],
                    'horario':     d['horario'],
                    'status':      'confirmado',
                    'criado_em':   datetime.datetime.now().isoformat(),
                }).execute()
            return (
                f"Marcado! ✨\n\n"
                f"📅 {d['data']} às {d['horario']}\n"
                f"💅 {d['servico']['nome']} com a {d['manicure']['nome']}\n\n"
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
            "Que legal, vamos criar sua conta! 🎉\n\n"
            "Pra começar, me fala seu **nome completo**?"
        )

    def _proc_cadastro_nome(self, sessao, mensagem):
        nome = mensagem.strip()
        if len(nome) < 3:
            return "Hmm, acho que faltou algo 😅 Me manda seu nome completo, por favor!"
        sessao.dados_cadastro['nome'] = nome
        sessao.estado_fluxo = "cadastro_email"
        return f"Prazer, *{nome}*! 😊\n\nAgora me passa seu **e-mail**, por favor?"

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
            "Beleza! E seu **celular** com DDD? (tipo 11999999999)\n\n"
            "Se preferir não informar agora, pode falar **pular** 😉"
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
        try:
            if SUPABASE_DISPONIVEL:
                res = supabase.table('clientes').insert({
                    'nome':    d['nome'],
                    'email':   d['email'],
                    'celular': d.get('celular'),
                    'ativo':   True,
                }).execute()
                if res.data:
                    sessao.cliente = res.data[0]
                    logger.info(f"Novo cliente cadastrado: {res.data[0].get('id')} — {d['nome']}")
            else:
                # Modo demo — simula login sem persistência
                sessao.cliente = {'id': 999, 'nome': d['nome'], 'email': d['email'], 'celular': d.get('celular')}
            return (
                f"Pronto, tudo certo! Bem-vinda, *{d['nome']}*! 🎉\n\n"
                f"Você já tá logada! Se quiser marcar um horário, me fala **agendar**, "
                f"ou posso te mostrar nossos **serviços** também! 💅"
            )
        except Exception as e:
            logger.error(f"Erro ao salvar cadastro: {e}")
            return "Poxa, deu um erro aqui 😔 Tenta de novo, por favor? Se continuar dando problema, entra em contato com a gente!"


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
        # --- Escape cancelar ---
        "login",
        "cancelar",
    ]

    for msg in mensagens_teste:
        print(f"\n[React User]: {msg}")
        resposta_json = motor.processar_mensagem(session_id, msg)
        print(f"[API Response]: {json.dumps(resposta_json, ensure_ascii=False, indent=2)}")