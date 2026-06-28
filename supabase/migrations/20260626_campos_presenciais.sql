-- Adiciona campos estruturados para reserva presencial
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS presencial_nome     text,
  ADD COLUMN IF NOT EXISTS presencial_torre    text,
  ADD COLUMN IF NOT EXISTS presencial_apt      text,
  ADD COLUMN IF NOT EXISTS presencial_bloco    text,
  ADD COLUMN IF NOT EXISTS presencial_documento text;
