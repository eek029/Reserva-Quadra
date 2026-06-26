import { NextRequest, NextResponse } from 'next/server'

export interface ApiValidationConfig {
  maxSizeBytes?: number
  contentType?: string
}

const DEFAULT_MAX_SIZE = 1024 * 1024 // 1MB

/**
 * Valida Content-Type e tamanho do payload de uma requisição
 * Retorna null se válido, ou NextResponse de erro se inválido
 */
export function validateRequestPayload(
  request: NextRequest,
  config: ApiValidationConfig = {}
): NextResponse | null {
  const { maxSizeBytes = DEFAULT_MAX_SIZE, contentType = 'application/json' } = config

  // Validar Content-Type
  const requestContentType = request.headers.get('content-type')
  if (!requestContentType?.includes(contentType)) {
    return NextResponse.json(
      { error: `Content-Type deve ser ${contentType}` },
      { status: 400 }
    )
  }

  // Validar tamanho do payload
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > maxSizeBytes) {
      return NextResponse.json(
        { error: `Payload muito grande. Máximo: ${maxSizeBytes} bytes` },
        { status: 413 }
      )
    }
  }

  return null
}
