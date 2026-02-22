import os
from datetime import datetime, time, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import pytz

load_dotenv()

app = FastAPI()

# Supabase configuration
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ANON_KEY")
encryption_key: str = os.environ.get("ENCRYPTION_KEY")
supabase: Client = create_client(url, key)

# --- Models ---
class UsuarioBase(BaseModel):
    nome_completo: str
    data_nascimento: str
    telefone: str
    apartamento: Optional[str] = None
    torre: Optional[str] = None
    bloco: Optional[str] = None
    foto_url: Optional[str] = None
    cargo: str = "Morador"

class UsuarioCreate(UsuarioBase):
    rg: str
    cpf: str

class UsuarioUpdate(BaseModel):
    nome_completo: Optional[str] = None
    rg: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    foto_url: Optional[str] = None

class ReservaBase(BaseModel):
    data_reserva: str
    hora_inicio: str
    hora_fim: str
    aceite_termos: bool = True

class ReservaCreate(ReservaBase):
    usuario_id: str

class NotificacaoCreate(BaseModel):
    mensagem: str
    destinatario_id: Optional[str] = None

class ChaveAcao(BaseModel):
    acao: str # 'entregar' ou 'receber'
    ocorrencia_texto: Optional[str] = None

# --- Helper Functions ---

async def log_audit(perfil_id: str, acao: str, detalhes: dict):
    """Registra log de auditoria no Supabase."""
    supabase.table("audit_logs").insert({
        "perfil_id": perfil_id,
        "acao": acao,
        "detalhes": detalhes
    }).execute()

def validate_reservation_time(hora_inicio_str: str, hora_fim_str: str):
    """Valida se o horário da reserva está entre 09h e 22h e se é válido."""
    h_inicio = time.fromisoformat(hora_inicio_str)
    h_fim = time.fromisoformat(hora_fim_str)
    
    if h_inicio < time(9, 0) or h_fim > time(22, 0):
        raise HTTPException(status_code=400, detail="A quadra só funciona das 09h às 22h.")
    
    if h_inicio >= h_fim:
        raise HTTPException(status_code=400, detail="Horário de início deve ser anterior ao fim.")

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"message": "API Reserva Quadra - Condomínio Júlio Prestes"}

# --- Usuarios CRUD ---

@app.get("/api/usuarios/{usuario_id}")
async def get_usuario(usuario_id: str, requester_id: str = Header(...)):
    """Busca usuário descriptografando RG e CPF e gerando log de auditoria."""
    
    result = supabase.rpc("get_usuario_decrypted", {
        "target_id": usuario_id,
        "secret_key": encryption_key
    }).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Registro automático de log de auditoria conforme requisito
    await log_audit(
        requester_id, 
        "visualizou_dados_sensiveis", 
        {"alvo_usuario_id": usuario_id, "campos": ["rg", "cpf"]}
    )
    
    return result.data[0]

@app.post("/api/usuarios")
async def create_usuario(user: UsuarioCreate, auth_id: str):
    """Cria usuário criptografando RG e CPF via RPC."""
    
    result = supabase.rpc("create_usuario_encrypted", {
        "p_id": auth_id,
        "p_nome_completo": user.nome_completo,
        "p_data_nascimento": user.data_nascimento,
        "p_telefone": user.telefone,
        "p_apartamento": user.apartamento or "",
        "p_torre": user.torre or "",
        "p_bloco": user.bloco or "",
        "p_foto_url": user.foto_url or "",
        "p_cargo": user.cargo,
        "p_rg": user.rg,
        "p_cpf": user.cpf,
        "p_secret_key": encryption_key
    }).execute()
    
    return {"id": result.data, "status": "pendente"}

# --- Reservas CRUD ---

@app.post("/api/reservas/validate")
async def validate_reserva(reserva: ReservaCreate):
    """Valida as regras de negócio antes do frontend inserir."""
    
    # 1. Validação de horário de funcionamento (09h às 22h)
    validate_reservation_time(reserva.hora_inicio, reserva.hora_fim)
    
    # 2. Cálculo de duração da nova reserva
    h1 = datetime.combine(datetime.today(), time.fromisoformat(reserva.hora_inicio))
    h2 = datetime.combine(datetime.today(), time.fromisoformat(reserva.hora_fim))
    duracao_nova = (h2 - h1).total_seconds() / 3600
    
    if duracao_nova > 2:
        raise HTTPException(status_code=400, detail="Uma única reserva não pode exceder 2 horas.")

    # 3. Verificar limite de 2h/dia por usuário (unidade)
    reservas_dia = supabase.table("reservas") \
        .select("hora_inicio, hora_fim") \
        .eq("usuario_id", reserva.usuario_id) \
        .eq("data_reserva", reserva.data_reserva) \
        .eq("status", "ativa") \
        .execute()
    
    total_horas = duracao_nova
    for r in reservas_dia.data:
        start = datetime.combine(datetime.today(), time.fromisoformat(r['hora_inicio']))
        end = datetime.combine(datetime.today(), time.fromisoformat(r['hora_fim']))
        total_horas += (end - start).total_seconds() / 3600
        
    if total_horas > 2.001: # Tolerance for float
        raise HTTPException(status_code=400, detail="Limite de 2 horas por dia por unidade excedido.")

    # 4. Bloqueio de sobreposição (Overlapping)
    overlap = supabase.table("reservas") \
        .select("*") \
        .eq("data_reserva", reserva.data_reserva) \
        .eq("status", "ativa") \
        .execute()
        
    for r in overlap.data:
        # Check if [hora_inicio, hora_fim] overlaps with [r.hora_inicio, r.hora_fim]
        if (reserva.hora_inicio < r['hora_fim']) and (reserva.hora_fim > r['hora_inicio']):
            raise HTTPException(status_code=400, detail="Já existe uma reserva para este horário.")

    # 5. Validação com sucesso
    return {"status": "valid"}

@app.get("/api/reservas")
async def list_reservas(data: Optional[str] = None):
    query = supabase.table("reservas").select("*, usuarios(nome_completo, torre, apartamento)")
    if data:
        query = query.eq("data_reserva", data)
    result = query.execute()
    return result.data

@app.delete("/api/reservas/{reserva_id}")
async def cancel_reserva(reserva_id: str):
    result = supabase.table("reservas").update({"status": "cancelada"}).eq("id", reserva_id).execute()
    return {"message": "Reserva cancelada com sucesso"}

# --- Historico de Chaves / Turno ---
@app.patch("/api/reservas/{reserva_id}/chave")
async def update_chave_reserva(reserva_id: str, payload: ChaveAcao, requester_id: str = Header(...)):
    """Gerencia entrega e recebimento de chaves + auditoria."""
    
    # 1. Verifica admin/porteiro
    admin_check = supabase.table("usuarios").select("cargo").eq("id", requester_id).single().execute()
    if not admin_check.data or admin_check.data["cargo"] not in ['SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro']:
         raise HTTPException(status_code=403, detail="Sem permissão.")

    # 2. Captura hora e define turno via servidor (BRT)
    brt_tz = pytz.timezone('America/Sao_Paulo')
    agora = datetime.now(brt_tz)
    hora_atual = agora.hour
    nova_timestamp = agora.isoformat()

    turno = "Turno Noite"
    if 7 <= hora_atual < 19:
        turno = "Turno Dia"

    update_payload = {"turno_registro": turno}

    if payload.acao == 'entregar':
        update_payload["status_chave"] = "em_uso"
        update_payload["retirada_em"] = nova_timestamp
        update_payload["entregue_por"] = requester_id
    elif payload.acao == 'receber':
        update_payload["status_chave"] = "concluida"
        update_payload["devolvida_em"] = nova_timestamp
        update_payload["recebida_por"] = requester_id
        if payload.ocorrencia_texto:
            update_payload["ocorrencia_texto"] = payload.ocorrencia_texto
    else:
        raise HTTPException(status_code=400, detail="Ação inválida")

    result = supabase.table("reservas").update(update_payload).eq("id", reserva_id).execute()
    
    if not result.data:
         raise HTTPException(status_code=404, detail="Reserva não encontrada.")

    return result.data[0]

# --- Notificacoes CRUD ---

@app.get("/api/notificacoes")
async def list_notificacoes(requester_id: str = Header(...)):
    """Lista notificações para o usuário ou globais usando o header de autorização indiretamente na policy (ou via query se RLS assumir role auth)."""
    # Como não estamos repassando o JWT neste modelo simplificado de Client, 
    # as policies RLS não verão o auth.uid() da requisição servidor-a-servidor a não ser que façamos impersonation.
    # Solução Pragmática: o Backend Python buscará com a chave Admin e aplicará o filtro do destinátario programaticamente 
    # se o token usado for a anon ou service key padrão sem JWT spoofing.
    
    result = supabase.table("notificacoes") \
        .select("*") \
        .or_(f"destinatario_id.eq.{requester_id},destinatario_id.is.null") \
        .order("created_at", desc=True) \
        .execute()
    return result.data

@app.post("/api/notificacoes")
async def create_notificacoes(notificacao: NotificacaoCreate, requester_id: str = Header(...)):
    """Cria uma nova notificação (Apenas admins)."""
    # Validação de admin via backend além da RLS
    admin_check = supabase.table("usuarios").select("cargo").eq("id", requester_id).single().execute()
    if not admin_check.data or admin_check.data["cargo"] not in ['SysAdmin', 'Síndico Geral', 'Subsíndico']:
         raise HTTPException(status_code=403, detail="Sem permissão para criar notificações.")

    result = supabase.table("notificacoes").insert({
        "mensagem": notificacao.mensagem,
        "destinatario_id": notificacao.destinatario_id
    }).execute()
    return result.data[0]

@app.patch("/api/notificacoes/{notificacao_id}/lida")
async def mark_notificacao_lida(notificacao_id: str, requester_id: str = Header(...)):
    """Seta lida = true"""
    # Verifica se pertence ao usuário
    check = supabase.table("notificacoes").select("destinatario_id").eq("id", notificacao_id).single().execute()
    if check.data and check.data["destinatario_id"] and check.data["destinatario_id"] != requester_id:
        raise HTTPException(status_code=403, detail="Não pertence a você.")

    result = supabase.table("notificacoes").update({"lida": True}).eq("id", notificacao_id).execute()
    return {"status": "ok"}
