"""
API FastAPI que expõe o agente da Lino Esmalteria.
Roda em http://localhost:8000 e é exposta via Cloudflare Tunnel.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import os

# Importa o motor do seu agente
from agente import MotorDialogo

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


class ChatPayload(BaseModel):
    message: str
    user_id: str = "web-user"


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
