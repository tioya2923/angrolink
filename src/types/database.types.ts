export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      administradores: {
        Row: {
          criado_em: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          user_id?: string
        }
        Relationships: []
      }
      areas_cobertura_entrega: {
        Row: {
          ativo: boolean
          bairro: string | null
          criado_em: string
          id: string
          municipio: string
          parceiro_id: string
          provincia: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          criado_em?: string
          id?: string
          municipio: string
          parceiro_id: string
          provincia: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          criado_em?: string
          id?: string
          municipio?: string
          parceiro_id?: string
          provincia?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_cobertura_entrega_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      atribuicoes_entrega_encomenda: {
        Row: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        Insert: {
          aceite_em?: string | null
          atribuido_em?: string
          atribuido_por: string
          atualizado_em?: string
          cancelado_em?: string | null
          chegou_destino_em?: string | null
          chegou_origem_em?: string | null
          concluido_em?: string | null
          criado_em?: string
          encomenda_id: string
          estado?: string
          id?: string
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          parceiro_entrega_id: string
          recolhida_em?: string | null
          recusado_em?: string | null
          veiculo_id: string
        }
        Update: {
          aceite_em?: string | null
          atribuido_em?: string
          atribuido_por?: string
          atualizado_em?: string
          cancelado_em?: string | null
          chegou_destino_em?: string | null
          chegou_origem_em?: string | null
          concluido_em?: string | null
          criado_em?: string
          encomenda_id?: string
          estado?: string
          id?: string
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          parceiro_entrega_id?: string
          recolhida_em?: string | null
          recusado_em?: string | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_entrega_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_entrega_encomenda_parceiro_entrega_id_fkey"
            columns: ["parceiro_entrega_id"]
            isOneToOne: false
            referencedRelation: "parceiros_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_entrega_encomenda_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_administrativa: {
        Row: {
          acao: string
          admin_user_id: string
          criado_em: string
          entidade_id: string
          entidade_tipo: string
          estado_anterior: string | null
          estado_novo: string
          id: string
          metadados: Json
          motivo: string | null
        }
        Insert: {
          acao: string
          admin_user_id: string
          criado_em?: string
          entidade_id: string
          entidade_tipo: string
          estado_anterior?: string | null
          estado_novo: string
          id?: string
          metadados?: Json
          motivo?: string | null
        }
        Update: {
          acao?: string
          admin_user_id?: string
          criado_em?: string
          entidade_id?: string
          entidade_tipo?: string
          estado_anterior?: string | null
          estado_novo?: string
          id?: string
          metadados?: Json
          motivo?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id?: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
        }
        Relationships: []
      }
      categorias_servico: {
        Row: {
          ativa: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          atualizado_em: string | null
          conta_ativa: boolean | null
          criado_em: string | null
          email: string | null
          email_login: string | null
          foto_perfil: string | null
          id: string
          indicativo_telefone: string | null
          municipio: string | null
          nome: string | null
          provincia: string | null
          telefone: string | null
          telefone_nacional: string | null
          tipo_comprador: string | null
        }
        Insert: {
          atualizado_em?: string | null
          conta_ativa?: boolean | null
          criado_em?: string | null
          email?: string | null
          email_login?: string | null
          foto_perfil?: string | null
          id: string
          indicativo_telefone?: string | null
          municipio?: string | null
          nome?: string | null
          provincia?: string | null
          telefone?: string | null
          telefone_nacional?: string | null
          tipo_comprador?: string | null
        }
        Update: {
          atualizado_em?: string | null
          conta_ativa?: boolean | null
          criado_em?: string | null
          email?: string | null
          email_login?: string | null
          foto_perfil?: string | null
          id?: string
          indicativo_telefone?: string | null
          municipio?: string | null
          nome?: string | null
          provincia?: string | null
          telefone?: string | null
          telefone_nacional?: string | null
          tipo_comprador?: string | null
        }
        Relationships: []
      }
      codigos_entrega: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          bloqueado_em: string | null
          codigo_hash: string
          criado_em: string
          criado_por: string
          encomenda_id: string
          expira_em: string
          geracoes: number
          gerado_em: string
          id: string
          max_tentativas: number
          tentativas: number
          usado_em: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          bloqueado_em?: string | null
          codigo_hash: string
          criado_em?: string
          criado_por: string
          encomenda_id: string
          expira_em: string
          geracoes?: number
          gerado_em?: string
          id?: string
          max_tentativas?: number
          tentativas?: number
          usado_em?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          bloqueado_em?: string | null
          codigo_hash?: string
          criado_em?: string
          criado_por?: string
          encomenda_id?: string
          expira_em?: string
          geracoes?: number
          gerado_em?: string
          id?: string
          max_tentativas?: number
          tentativas?: number
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codigos_entrega_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: true
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      codigos_levantamento: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          bloqueado_em: string | null
          codigo_hash: string
          criado_em: string
          criado_por: string
          encomenda_id: string
          expira_em: string
          geracoes: number
          gerado_em: string
          id: string
          max_tentativas: number
          tentativas: number
          usado_em: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          bloqueado_em?: string | null
          codigo_hash: string
          criado_em?: string
          criado_por: string
          encomenda_id: string
          expira_em: string
          geracoes?: number
          gerado_em?: string
          id?: string
          max_tentativas?: number
          tentativas?: number
          usado_em?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          bloqueado_em?: string | null
          codigo_hash?: string
          criado_em?: string
          criado_por?: string
          encomenda_id?: string
          expira_em?: string
          geracoes?: number
          gerado_em?: string
          id?: string
          max_tentativas?: number
          tentativas?: number
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codigos_levantamento_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: true
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_operacional_catalogo_produto: {
        Row: {
          atualizado_em: string
          aviso_visual: string | null
          categoria_id: string
          criado_em: string
          estado: string
          id: string
          provincia_id: string
          requer_revisao_admin: boolean
          subcategoria_id: string | null
        }
        Insert: {
          atualizado_em?: string
          aviso_visual?: string | null
          categoria_id: string
          criado_em?: string
          estado: string
          id?: string
          provincia_id: string
          requer_revisao_admin?: boolean
          subcategoria_id?: string | null
        }
        Update: {
          atualizado_em?: string
          aviso_visual?: string | null
          categoria_id?: string
          criado_em?: string
          estado?: string
          id?: string
          provincia_id?: string
          requer_revisao_admin?: boolean
          subcategoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracao_operacional_catalogo_produto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracao_operacional_catalogo_produto_provincia_id_fkey"
            columns: ["provincia_id"]
            isOneToOne: false
            referencedRelation: "provincias_angola"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracao_operacional_catalogo_subcategoria_categoria_fkey"
            columns: ["subcategoria_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_produto"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      configuracoes_financeiras: {
        Row: {
          ativo: boolean
          atualizado_em: string
          chave: string
          comissao_bps: number
          criado_em: string
          prazo_reclamacao_horas: number
          prazo_repasse_horas: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          chave: string
          comissao_bps?: number
          criado_em?: string
          prazo_reclamacao_horas?: number
          prazo_repasse_horas?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          chave?: string
          comissao_bps?: number
          criado_em?: string
          prazo_reclamacao_horas?: number
          prazo_repasse_horas?: number
        }
        Relationships: []
      }
      disputas_encomenda: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          cliente_id: string
          criado_em: string
          decisao: string | null
          descricao: string
          encomenda_id: string
          estado: string
          id: string
          observacao_resolucao: string | null
          pagamento_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo_problema: string
          valor_reclamado_centimos: number | null
          vendedor_id: string
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          atualizado_em?: string
          cliente_id: string
          criado_em?: string
          decisao?: string | null
          descricao: string
          encomenda_id: string
          estado?: string
          id?: string
          observacao_resolucao?: string | null
          pagamento_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tipo_problema: string
          valor_reclamado_centimos?: number | null
          vendedor_id: string
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          atualizado_em?: string
          cliente_id?: string
          criado_em?: string
          decisao?: string | null
          descricao?: string
          encomenda_id?: string
          estado?: string
          id?: string
          observacao_resolucao?: string | null
          pagamento_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tipo_problema?: string
          valor_reclamado_centimos?: number | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputas_encomenda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputas_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputas_encomenda_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputas_encomenda_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_parceiro_entrega: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          criado_em: string
          estado: string
          frente_path: string
          id: string
          motivo_rejeicao: string | null
          numero_documento: string | null
          parceiro_id: string
          tipo_documento: string
          validade: string | null
          veiculo_id: string | null
          versao_atual_id: string | null
          verso_path: string
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          estado?: string
          frente_path: string
          id?: string
          motivo_rejeicao?: string | null
          numero_documento?: string | null
          parceiro_id: string
          tipo_documento: string
          validade?: string | null
          veiculo_id?: string | null
          versao_atual_id?: string | null
          verso_path: string
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          estado?: string
          frente_path?: string
          id?: string
          motivo_rejeicao?: string | null
          numero_documento?: string | null
          parceiro_id?: string
          tipo_documento?: string
          validade?: string | null
          veiculo_id?: string | null
          versao_atual_id?: string | null
          verso_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_parceiro_entrega_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_parceiro_entrega_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_parceiro_versao_atual_fkey"
            columns: ["versao_atual_id"]
            isOneToOne: false
            referencedRelation: "versoes_documento_parceiro_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_vendedor: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          criado_em: string
          dados_adicionais: Json
          estado: string
          frente_path: string
          id: string
          motivo_rejeicao: string | null
          numero_documento: string | null
          obrigatorio_para_aprovacao: boolean
          tipo_documento: string
          validade: string | null
          vendedor_id: string
          verso_path: string | null
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          dados_adicionais?: Json
          estado?: string
          frente_path: string
          id?: string
          motivo_rejeicao?: string | null
          numero_documento?: string | null
          obrigatorio_para_aprovacao?: boolean
          tipo_documento: string
          validade?: string | null
          vendedor_id: string
          verso_path?: string | null
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          dados_adicionais?: Json
          estado?: string
          frente_path?: string
          id?: string
          motivo_rejeicao?: string | null
          numero_documento?: string | null
          obrigatorio_para_aprovacao?: boolean
          tipo_documento?: string
          validade?: string | null
          vendedor_id?: string
          verso_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_vendedor_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_vendedor_eventos: {
        Row: {
          criado_em: string
          detalhes: Json
          documento_id: string
          estado_anterior: string | null
          estado_novo: string | null
          evento: string
          id: string
          motivo_rejeicao: string | null
          realizado_por: string | null
          vendedor_id: string
        }
        Insert: {
          criado_em?: string
          detalhes?: Json
          documento_id: string
          estado_anterior?: string | null
          estado_novo?: string | null
          evento: string
          id?: string
          motivo_rejeicao?: string | null
          realizado_por?: string | null
          vendedor_id: string
        }
        Update: {
          criado_em?: string
          detalhes?: Json
          documento_id?: string
          estado_anterior?: string | null
          estado_novo?: string | null
          evento?: string
          id?: string
          motivo_rejeicao?: string | null
          realizado_por?: string | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_vendedor_eventos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_vendedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_vendedor_eventos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      encomendas: {
        Row: {
          atualizado_em: string
          bairro: string | null
          cancelado_em: string | null
          cliente_id: string
          codigo_publico: string
          concluido_em: string | null
          confirmado_em: string | null
          criado_em: string
          desconto_centimos: number
          destinatario_nome: string
          destinatario_telefone: string
          endereco_levantamento: string | null
          entrega_centimos: number
          estado: string
          id: string
          modalidade_recebimento: string
          moeda: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          municipio: string | null
          observacoes_cliente: string | null
          ponto_referencia: string | null
          provincia: string | null
          recusado_em: string | null
          subtotal_centimos: number
          total_centimos: number
          vendedor_id: string
        }
        Insert: {
          atualizado_em?: string
          bairro?: string | null
          cancelado_em?: string | null
          cliente_id: string
          codigo_publico: string
          concluido_em?: string | null
          confirmado_em?: string | null
          criado_em?: string
          desconto_centimos?: number
          destinatario_nome: string
          destinatario_telefone: string
          endereco_levantamento?: string | null
          entrega_centimos?: number
          estado?: string
          id?: string
          modalidade_recebimento?: string
          moeda?: string
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          municipio?: string | null
          observacoes_cliente?: string | null
          ponto_referencia?: string | null
          provincia?: string | null
          recusado_em?: string | null
          subtotal_centimos: number
          total_centimos: number
          vendedor_id: string
        }
        Update: {
          atualizado_em?: string
          bairro?: string | null
          cancelado_em?: string | null
          cliente_id?: string
          codigo_publico?: string
          concluido_em?: string | null
          confirmado_em?: string | null
          criado_em?: string
          desconto_centimos?: number
          destinatario_nome?: string
          destinatario_telefone?: string
          endereco_levantamento?: string | null
          entrega_centimos?: number
          estado?: string
          id?: string
          modalidade_recebimento?: string
          moeda?: string
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          municipio?: string | null
          observacoes_cliente?: string | null
          ponto_referencia?: string | null
          provincia?: string | null
          recusado_em?: string | null
          subtotal_centimos?: number
          total_centimos?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encomendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      enderecos_entrega_encomenda: {
        Row: {
          bairro: string
          criado_em: string
          destinatario_nome: string
          destinatario_telefone: string
          encomenda_id: string
          endereco_detalhado: string
          instrucoes_entrega: string | null
          municipio: string
          ponto_referencia: string | null
          provincia: string
        }
        Insert: {
          bairro: string
          criado_em?: string
          destinatario_nome: string
          destinatario_telefone: string
          encomenda_id: string
          endereco_detalhado: string
          instrucoes_entrega?: string | null
          municipio: string
          ponto_referencia?: string | null
          provincia: string
        }
        Update: {
          bairro?: string
          criado_em?: string
          destinatario_nome?: string
          destinatario_telefone?: string
          encomenda_id?: string
          endereco_detalhado?: string
          instrucoes_entrega?: string | null
          municipio?: string
          ponto_referencia?: string | null
          provincia?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_entrega_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: true
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_documento_parceiro_entrega: {
        Row: {
          ator_tipo: string
          criado_em: string
          documento_id: string
          estado_anterior: string | null
          estado_novo: string | null
          evento: string
          id: string
          motivo: string | null
          parceiro_id: string
          utilizador_id: string | null
          versao_id: string | null
        }
        Insert: {
          ator_tipo: string
          criado_em?: string
          documento_id: string
          estado_anterior?: string | null
          estado_novo?: string | null
          evento: string
          id?: string
          motivo?: string | null
          parceiro_id: string
          utilizador_id?: string | null
          versao_id?: string | null
        }
        Update: {
          ator_tipo?: string
          criado_em?: string
          documento_id?: string
          estado_anterior?: string | null
          estado_novo?: string | null
          evento?: string
          id?: string
          motivo?: string | null
          parceiro_id?: string
          utilizador_id?: string | null
          versao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_documento_parceiro_entrega_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_parceiro_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_documento_parceiro_entrega_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_documento_parceiro_entrega_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "versoes_documento_parceiro_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_encomenda: {
        Row: {
          ator_tipo: string
          criado_em: string
          encomenda_id: string
          estado_anterior: string | null
          estado_novo: string
          id: string
          metadados: Json
          tipo_evento: string
          utilizador_id: string | null
        }
        Insert: {
          ator_tipo: string
          criado_em?: string
          encomenda_id: string
          estado_anterior?: string | null
          estado_novo: string
          id?: string
          metadados?: Json
          tipo_evento: string
          utilizador_id?: string | null
        }
        Update: {
          ator_tipo?: string
          criado_em?: string
          encomenda_id?: string
          estado_anterior?: string | null
          estado_novo?: string
          id?: string
          metadados?: Json
          tipo_evento?: string
          utilizador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_pagamento: {
        Row: {
          ator_tipo: string
          criado_em: string
          encomenda_id: string
          estado_anterior: string | null
          estado_novo: string
          id: string
          metadados: Json
          pagamento_id: string
          tentativa_pagamento_id: string | null
          tipo_evento: string
          utilizador_id: string | null
        }
        Insert: {
          ator_tipo: string
          criado_em?: string
          encomenda_id: string
          estado_anterior?: string | null
          estado_novo: string
          id?: string
          metadados?: Json
          pagamento_id: string
          tentativa_pagamento_id?: string | null
          tipo_evento: string
          utilizador_id?: string | null
        }
        Update: {
          ator_tipo?: string
          criado_em?: string
          encomenda_id?: string
          estado_anterior?: string | null
          estado_novo?: string
          id?: string
          metadados?: Json
          pagamento_id?: string
          tentativa_pagamento_id?: string | null
          tipo_evento?: string
          utilizador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_pagamento_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_pagamento_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_pagamento_tentativa_pagamento_id_fkey"
            columns: ["tentativa_pagamento_id"]
            isOneToOne: false
            referencedRelation: "tentativas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      favoritos: {
        Row: {
          criado_em: string | null
          id: string
          produto_id: string | null
          servico_id: string | null
          utilizador_id: string
          vendedor_id: string | null
        }
        Insert: {
          criado_em?: string | null
          id?: string
          produto_id?: string | null
          servico_id?: string | null
          utilizador_id: string
          vendedor_id?: string | null
        }
        Update: {
          criado_em?: string | null
          id?: string
          produto_id?: string | null
          servico_id?: string | null
          utilizador_id?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favoritos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_utilizador_id_fkey"
            columns: ["utilizador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_contactos: {
        Row: {
          atualizado_em: string | null
          cliente_id: string | null
          criado_em: string | null
          id: string
          nome_produto: string | null
          nome_vendedor: string | null
          produto_id: string | null
          vendedor_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          nome_produto?: string | null
          nome_vendedor?: string | null
          produto_id?: string | null
          vendedor_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          nome_produto?: string | null
          nome_vendedor?: string | null
          produto_id?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_contactos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_contactos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_contactos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_contactos_servicos: {
        Row: {
          atualizado_em: string | null
          cliente_id: string | null
          criado_em: string | null
          id: string
          nome_prestador: string | null
          nome_servico: string | null
          servico_id: string | null
          vendedor_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          nome_prestador?: string | null
          nome_servico?: string | null
          servico_id?: string | null
          vendedor_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          nome_prestador?: string | null
          nome_servico?: string | null
          servico_id?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_contactos_servicos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_contactos_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_contactos_servicos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_pesquisas: {
        Row: {
          categoria_id: string | null
          cliente_id: string | null
          criado_em: string | null
          id: string
          municipio: string | null
          provincia: string | null
          termo: string | null
          tipo_comprador: string | null
        }
        Insert: {
          categoria_id?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          municipio?: string | null
          provincia?: string | null
          termo?: string | null
          tipo_comprador?: string | null
        }
        Update: {
          categoria_id?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          municipio?: string | null
          provincia?: string | null
          termo?: string | null
          tipo_comprador?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_pesquisas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_pesquisas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotencia_checkout_encomenda: {
        Row: {
          chave_idempotencia: string
          cliente_id: string
          concluida_em: string | null
          criada_em: string
          encomenda_id: string | null
          id: string
          modalidade_recebimento: string
          payload_hash: string
        }
        Insert: {
          chave_idempotencia: string
          cliente_id: string
          concluida_em?: string | null
          criada_em?: string
          encomenda_id?: string | null
          id?: string
          modalidade_recebimento: string
          payload_hash: string
        }
        Update: {
          chave_idempotencia?: string
          cliente_id?: string
          concluida_em?: string | null
          criada_em?: string
          encomenda_id?: string | null
          id?: string
          modalidade_recebimento?: string
          payload_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotencia_checkout_encomenda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idempotencia_checkout_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotencia_intervencao_entrega_admin: {
        Row: {
          administrador_id: string
          atribuicao_id: string | null
          chave_idempotencia: string
          concluida_em: string | null
          criada_em: string
          id: string
          incidente_id: string | null
          operacao: string
          payload_hash: string
        }
        Insert: {
          administrador_id: string
          atribuicao_id?: string | null
          chave_idempotencia: string
          concluida_em?: string | null
          criada_em?: string
          id?: string
          incidente_id?: string | null
          operacao: string
          payload_hash: string
        }
        Update: {
          administrador_id?: string
          atribuicao_id?: string | null
          chave_idempotencia?: string
          concluida_em?: string | null
          criada_em?: string
          id?: string
          incidente_id?: string | null
          operacao?: string
          payload_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotencia_intervencao_entrega_admin_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes_entrega_encomenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idempotencia_intervencao_incidente_fk"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "incidentes_operacionais_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes_operacionais_entrega: {
        Row: {
          atribuicao_id: string
          atualizado_em: string
          criado_em: string
          criado_por: string
          encomenda_id: string
          estado: string
          id: string
          motivo: string
          observacao_resolucao: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo: string
        }
        Insert: {
          atribuicao_id: string
          atualizado_em?: string
          criado_em?: string
          criado_por: string
          encomenda_id: string
          estado?: string
          id?: string
          motivo: string
          observacao_resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tipo: string
        }
        Update: {
          atribuicao_id?: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string
          encomenda_id?: string
          estado?: string
          id?: string
          motivo?: string
          observacao_resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_operacionais_entrega_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes_entrega_encomenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidentes_operacionais_entrega_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_encomenda: {
        Row: {
          criado_em: string
          descricao_snapshot: string | null
          encomenda_id: string
          id: string
          imagem_principal_snapshot: string | null
          nome_produto_snapshot: string
          peso_por_unidade_comercial_kg_snapshot: number | null
          produto_id: string | null
          quantidade: number
          requer_caixa_carga_snapshot: boolean | null
          requer_paletes_snapshot: boolean | null
          requer_refrigeracao_snapshot: boolean | null
          subtotal_centimos: number
          tipo_preco_snapshot: string
          unidade: string
          valor_unitario_centimos: number
          vendedor_id: string
          volume_por_unidade_comercial_m3_snapshot: number | null
        }
        Insert: {
          criado_em?: string
          descricao_snapshot?: string | null
          encomenda_id: string
          id?: string
          imagem_principal_snapshot?: string | null
          nome_produto_snapshot: string
          peso_por_unidade_comercial_kg_snapshot?: number | null
          produto_id?: string | null
          quantidade: number
          requer_caixa_carga_snapshot?: boolean | null
          requer_paletes_snapshot?: boolean | null
          requer_refrigeracao_snapshot?: boolean | null
          subtotal_centimos: number
          tipo_preco_snapshot: string
          unidade: string
          valor_unitario_centimos: number
          vendedor_id: string
          volume_por_unidade_comercial_m3_snapshot?: number | null
        }
        Update: {
          criado_em?: string
          descricao_snapshot?: string | null
          encomenda_id?: string
          id?: string
          imagem_principal_snapshot?: string | null
          nome_produto_snapshot?: string
          peso_por_unidade_comercial_kg_snapshot?: number | null
          produto_id?: string | null
          quantidade?: number
          requer_caixa_carga_snapshot?: boolean | null
          requer_paletes_snapshot?: boolean | null
          requer_refrigeracao_snapshot?: boolean | null
          subtotal_centimos?: number
          tipo_preco_snapshot?: string
          unidade?: string
          valor_unitario_centimos?: number
          vendedor_id?: string
          volume_por_unidade_comercial_m3_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_encomenda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_encomenda_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      leituras_mensagens_encomenda: {
        Row: {
          atribuicao_entrega_id: string | null
          canal: string
          encomenda_id: string
          id: string
          ultima_leitura_em: string
          utilizador_id: string
        }
        Insert: {
          atribuicao_entrega_id?: string | null
          canal: string
          encomenda_id: string
          id?: string
          ultima_leitura_em: string
          utilizador_id: string
        }
        Update: {
          atribuicao_entrega_id?: string | null
          canal?: string
          encomenda_id?: string
          id?: string
          ultima_leitura_em?: string
          utilizador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leituras_mensagens_encomenda_atribuicao_encomenda_fkey"
            columns: ["atribuicao_entrega_id", "encomenda_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes_entrega_encomenda"
            referencedColumns: ["id", "encomenda_id"]
          },
          {
            foreignKeyName: "leituras_mensagens_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_encomenda: {
        Row: {
          atribuicao_entrega_id: string | null
          canal: string
          corpo: string
          criado_em: string
          encomenda_id: string
          id: string
          remetente_user_id: string
        }
        Insert: {
          atribuicao_entrega_id?: string | null
          canal: string
          corpo: string
          criado_em?: string
          encomenda_id: string
          id?: string
          remetente_user_id: string
        }
        Update: {
          atribuicao_entrega_id?: string | null
          canal?: string
          corpo?: string
          criado_em?: string
          encomenda_id?: string
          id?: string
          remetente_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_encomenda_atribuicao_encomenda_fkey"
            columns: ["atribuicao_entrega_id", "encomenda_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes_entrega_encomenda"
            referencedColumns: ["id", "encomenda_id"]
          },
          {
            foreignKeyName: "mensagens_encomenda_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentos_financeiros: {
        Row: {
          chave_idempotencia: string | null
          cliente_id: string | null
          criado_em: string
          direcao: string
          encomenda_id: string
          entidade_creditada: string
          entidade_debitada: string
          id: string
          metadados: Json
          moeda: string
          pagamento_id: string | null
          referencia_origem: string
          tipo_movimento: string
          valor_centimos: number
          vendedor_id: string | null
        }
        Insert: {
          chave_idempotencia?: string | null
          cliente_id?: string | null
          criado_em?: string
          direcao: string
          encomenda_id: string
          entidade_creditada: string
          entidade_debitada: string
          id?: string
          metadados?: Json
          moeda: string
          pagamento_id?: string | null
          referencia_origem: string
          tipo_movimento: string
          valor_centimos: number
          vendedor_id?: string | null
        }
        Update: {
          chave_idempotencia?: string | null
          cliente_id?: string | null
          criado_em?: string
          direcao?: string
          encomenda_id?: string
          entidade_creditada?: string
          entidade_debitada?: string
          id?: string
          metadados?: Json
          moeda?: string
          pagamento_id?: string | null
          referencia_origem?: string
          tipo_movimento?: string
          valor_centimos?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_financeiros_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      municipios_angola: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo_oficial: string
          criado_em: string
          id: string
          nome: string
          numero_oficial: string
          provincia_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo_oficial: string
          criado_em?: string
          id?: string
          nome: string
          numero_oficial: string
          provincia_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo_oficial?: string
          criado_em?: string
          id?: string
          nome?: string
          numero_oficial?: string
          provincia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipios_angola_provincia_id_fkey"
            columns: ["provincia_id"]
            isOneToOne: false
            referencedRelation: "provincias_angola"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          chave_idempotencia: string | null
          contexto: string
          criado_em: string
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          lida: boolean
          lida_em: string | null
          mensagem: string
          metadata: Json
          tipo: string
          titulo: string
          url_destino: string | null
          utilizador_id: string
        }
        Insert: {
          chave_idempotencia?: string | null
          contexto: string
          criado_em?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          mensagem: string
          metadata?: Json
          tipo: string
          titulo: string
          url_destino?: string | null
          utilizador_id: string
        }
        Update: {
          chave_idempotencia?: string | null
          contexto?: string
          criado_em?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          mensagem?: string
          metadata?: Json
          tipo?: string
          titulo?: string
          url_destino?: string | null
          utilizador_id?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          atualizado_em: string
          cancelado_em: string | null
          chave_idempotencia_criacao: string
          cliente_id: string
          comissao_angrolink_centimos: number
          comissao_bps_snapshot: number
          confirmado_em: string | null
          criado_em: string
          desconto_centimos: number
          encomenda_id: string
          entrega_centimos: number
          estado: string
          expirado_em: string | null
          falhado_em: string | null
          id: string
          moeda: string
          referencia_interna: string
          subtotal_centimos: number
          taxa_processador_centimos: number
          total_cliente_centimos: number
          valor_logistica_centimos: number
          valor_total_centimos: number
          valor_vendedor_centimos: number
          vendedor_id: string
        }
        Insert: {
          atualizado_em?: string
          cancelado_em?: string | null
          chave_idempotencia_criacao: string
          cliente_id: string
          comissao_angrolink_centimos?: number
          comissao_bps_snapshot: number
          confirmado_em?: string | null
          criado_em?: string
          desconto_centimos?: number
          encomenda_id: string
          entrega_centimos?: number
          estado?: string
          expirado_em?: string | null
          falhado_em?: string | null
          id?: string
          moeda: string
          referencia_interna: string
          subtotal_centimos: number
          taxa_processador_centimos?: number
          total_cliente_centimos: number
          valor_logistica_centimos?: number
          valor_total_centimos: number
          valor_vendedor_centimos: number
          vendedor_id: string
        }
        Update: {
          atualizado_em?: string
          cancelado_em?: string | null
          chave_idempotencia_criacao?: string
          cliente_id?: string
          comissao_angrolink_centimos?: number
          comissao_bps_snapshot?: number
          confirmado_em?: string | null
          criado_em?: string
          desconto_centimos?: number
          encomenda_id?: string
          entrega_centimos?: number
          estado?: string
          expirado_em?: string | null
          falhado_em?: string | null
          id?: string
          moeda?: string
          referencia_interna?: string
          subtotal_centimos?: number
          taxa_processador_centimos?: number
          total_cliente_centimos?: number
          valor_logistica_centimos?: number
          valor_total_centimos?: number
          valor_vendedor_centimos?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: true
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros_entrega: {
        Row: {
          aprovado_em: string | null
          atualizado_em: string
          bairro: string | null
          contacto_emergencia: string
          criado_em: string
          disponibilidade: boolean
          email: string | null
          estado: string
          foto_perfil_url: string | null
          id: string
          indicativo_telefone: string | null
          motivo_rejeicao: string | null
          motivo_suspensao: string | null
          municipio: string
          nome_completo: string
          provincia: string
          telefone: string
          telefone_nacional: string | null
          termos_aceites_em: string
          user_id: string
          zona_base: string | null
        }
        Insert: {
          aprovado_em?: string | null
          atualizado_em?: string
          bairro?: string | null
          contacto_emergencia: string
          criado_em?: string
          disponibilidade?: boolean
          email?: string | null
          estado?: string
          foto_perfil_url?: string | null
          id?: string
          indicativo_telefone?: string | null
          motivo_rejeicao?: string | null
          motivo_suspensao?: string | null
          municipio: string
          nome_completo: string
          provincia: string
          telefone: string
          telefone_nacional?: string | null
          termos_aceites_em?: string
          user_id: string
          zona_base?: string | null
        }
        Update: {
          aprovado_em?: string | null
          atualizado_em?: string
          bairro?: string | null
          contacto_emergencia?: string
          criado_em?: string
          disponibilidade?: boolean
          email?: string | null
          estado?: string
          foto_perfil_url?: string | null
          id?: string
          indicativo_telefone?: string | null
          motivo_rejeicao?: string | null
          motivo_suspensao?: string | null
          municipio?: string
          nome_completo?: string
          provincia?: string
          telefone?: string
          telefone_nacional?: string | null
          termos_aceites_em?: string
          user_id?: string
          zona_base?: string | null
        }
        Relationships: []
      }
      prestadores_servico: {
        Row: {
          atualizado_em: string
          conta_ativa: boolean
          criado_em: string
          descricao: string | null
          email: string | null
          foto_url: string | null
          id: string
          municipio: string | null
          nome_publico: string
          provincia: string | null
          status_aprovacao: string
          telefone_whatsapp: string | null
          tipo_prestador: string | null
          user_id: string
          verificado: boolean
        }
        Insert: {
          atualizado_em?: string
          conta_ativa?: boolean
          criado_em?: string
          descricao?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          municipio?: string | null
          nome_publico: string
          provincia?: string | null
          status_aprovacao?: string
          telefone_whatsapp?: string | null
          tipo_prestador?: string | null
          user_id: string
          verificado?: boolean
        }
        Update: {
          atualizado_em?: string
          conta_ativa?: boolean
          criado_em?: string
          descricao?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          municipio?: string | null
          nome_publico?: string
          provincia?: string | null
          status_aprovacao?: string
          telefone_whatsapp?: string | null
          tipo_prestador?: string | null
          user_id?: string
          verificado?: boolean
        }
        Relationships: []
      }
      produtos: {
        Row: {
          atualizado_em: string | null
          categoria_id: string | null
          cliques_whatsapp: number | null
          criado_em: string | null
          descricao: string | null
          destaque: boolean | null
          destaque_ate: string | null
          destaque_inicio: string | null
          disponivel: boolean | null
          id: string
          imagem_url: string | null
          municipio: string | null
          nome_produto: string
          peso_por_unidade_comercial_kg: number | null
          preco_aproximado: number | null
          preco_grosso: number | null
          preco_promocional: number | null
          provincia: string | null
          publicado: boolean | null
          quantidade_minima: number | null
          quantidade_minima_grosso: number | null
          requer_caixa_carga: boolean | null
          requer_paletes: boolean | null
          requer_refrigeracao: boolean | null
          subcategoria: string | null
          subcategoria_id: string | null
          tipo_destaque: string | null
          tipo_venda: string | null
          unidade: string | null
          vendedor_id: string | null
          visualizacoes: number | null
          volume_por_unidade_comercial_m3: number | null
        }
        Insert: {
          atualizado_em?: string | null
          categoria_id?: string | null
          cliques_whatsapp?: number | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          destaque_ate?: string | null
          destaque_inicio?: string | null
          disponivel?: boolean | null
          id?: string
          imagem_url?: string | null
          municipio?: string | null
          nome_produto: string
          peso_por_unidade_comercial_kg?: number | null
          preco_aproximado?: number | null
          preco_grosso?: number | null
          preco_promocional?: number | null
          provincia?: string | null
          publicado?: boolean | null
          quantidade_minima?: number | null
          quantidade_minima_grosso?: number | null
          requer_caixa_carga?: boolean | null
          requer_paletes?: boolean | null
          requer_refrigeracao?: boolean | null
          subcategoria?: string | null
          subcategoria_id?: string | null
          tipo_destaque?: string | null
          tipo_venda?: string | null
          unidade?: string | null
          vendedor_id?: string | null
          visualizacoes?: number | null
          volume_por_unidade_comercial_m3?: number | null
        }
        Update: {
          atualizado_em?: string | null
          categoria_id?: string | null
          cliques_whatsapp?: number | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          destaque_ate?: string | null
          destaque_inicio?: string | null
          disponivel?: boolean | null
          id?: string
          imagem_url?: string | null
          municipio?: string | null
          nome_produto?: string
          peso_por_unidade_comercial_kg?: number | null
          preco_aproximado?: number | null
          preco_grosso?: number | null
          preco_promocional?: number | null
          provincia?: string | null
          publicado?: boolean | null
          quantidade_minima?: number | null
          quantidade_minima_grosso?: number | null
          requer_caixa_carga?: boolean | null
          requer_paletes?: boolean | null
          requer_refrigeracao?: boolean | null
          subcategoria?: string | null
          subcategoria_id?: string | null
          tipo_destaque?: string | null
          tipo_venda?: string | null
          unidade?: string | null
          vendedor_id?: string | null
          visualizacoes?: number | null
          volume_por_unidade_comercial_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_produto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apagado_em: string | null
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          email: string | null
          id: string
          nome: string | null
          papel: string
          vendedor_id: string | null
        }
        Insert: {
          apagado_em?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          email?: string | null
          id: string
          nome?: string | null
          papel?: string
          vendedor_id?: string | null
        }
        Update: {
          apagado_em?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          papel?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      provincias_angola: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo_oficial: string
          criado_em: string
          id: string
          nome: string
          numero_oficial: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo_oficial: string
          criado_em?: string
          id?: string
          nome: string
          numero_oficial: string
          ordem: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo_oficial?: string
          criado_em?: string
          id?: string
          nome?: string
          numero_oficial?: string
          ordem?: number
        }
        Relationships: []
      }
      reembolsos_pagamento: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          atualizado_em: string
          cancelado_em: string | null
          chave_idempotencia: string
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          falhado_em: string | null
          id: string
          motivo: string
          pagamento_id: string
          processado_em: string | null
          recusado_em: string | null
          referencia_interna: string
          referencia_provedor: string | null
          solicitado_em: string
          solicitado_por: string | null
          valor_aprovado_centimos: number
          valor_entrega_aprovado_centimos: number
          valor_entrega_solicitado_centimos: number
          valor_produtos_aprovado_centimos: number
          valor_produtos_solicitado_centimos: number
          valor_solicitado_centimos: number
          valor_taxa_processador_aprovado_centimos: number
          valor_taxa_processador_solicitado_centimos: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          cancelado_em?: string | null
          chave_idempotencia: string
          concluido_em?: string | null
          criado_em?: string
          encomenda_id: string
          estado?: string
          falhado_em?: string | null
          id?: string
          motivo: string
          pagamento_id: string
          processado_em?: string | null
          recusado_em?: string | null
          referencia_interna: string
          referencia_provedor?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          valor_aprovado_centimos?: number
          valor_entrega_aprovado_centimos?: number
          valor_entrega_solicitado_centimos?: number
          valor_produtos_aprovado_centimos?: number
          valor_produtos_solicitado_centimos?: number
          valor_solicitado_centimos: number
          valor_taxa_processador_aprovado_centimos?: number
          valor_taxa_processador_solicitado_centimos?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          cancelado_em?: string | null
          chave_idempotencia?: string
          concluido_em?: string | null
          criado_em?: string
          encomenda_id?: string
          estado?: string
          falhado_em?: string | null
          id?: string
          motivo?: string
          pagamento_id?: string
          processado_em?: string | null
          recusado_em?: string | null
          referencia_interna?: string
          referencia_provedor?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          valor_aprovado_centimos?: number
          valor_entrega_aprovado_centimos?: number
          valor_entrega_solicitado_centimos?: number
          valor_produtos_aprovado_centimos?: number
          valor_produtos_solicitado_centimos?: number
          valor_solicitado_centimos?: number
          valor_taxa_processador_aprovado_centimos?: number
          valor_taxa_processador_solicitado_centimos?: number
        }
        Relationships: [
          {
            foreignKeyName: "reembolsos_pagamento_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reembolsos_pagamento_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      repasses_vendedor: {
        Row: {
          atualizado_em: string
          criado_em: string
          disponivel_em: string | null
          encomenda_id: string
          estado: string
          falhado_em: string | null
          id: string
          pagamento_id: string
          processado_em: string | null
          referencia: string | null
          valor_centimos: number
          vendedor_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          disponivel_em?: string | null
          encomenda_id: string
          estado?: string
          falhado_em?: string | null
          id?: string
          pagamento_id: string
          processado_em?: string | null
          referencia?: string | null
          valor_centimos: number
          vendedor_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          disponivel_em?: string | null
          encomenda_id?: string
          estado?: string
          falhado_em?: string | null
          id?: string
          pagamento_id?: string
          processado_em?: string | null
          referencia?: string | null
          valor_centimos?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repasses_vendedor_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: true
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_vendedor_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: true
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_vendedor_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitos_documentos_entrega: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          escopo: string
          id: string
          tipo_documento: string
          tipo_veiculo: string
          validade_obrigatoria: boolean
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          escopo: string
          id?: string
          tipo_documento: string
          tipo_veiculo: string
          validade_obrigatoria?: boolean
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          escopo?: string
          id?: string
          tipo_documento?: string
          tipo_veiculo?: string
          validade_obrigatoria?: boolean
        }
        Relationships: []
      }
      servicos: {
        Row: {
          atualizado_em: string | null
          categoria_id: string | null
          cliques_whatsapp: number | null
          criado_em: string | null
          descricao: string | null
          destaque: boolean | null
          destaque_ate: string | null
          destaque_inicio: string | null
          disponivel: boolean | null
          id: string
          imagem_url: string | null
          municipio: string | null
          nome_prestador: string | null
          nome_servico: string
          preco_estimado: number | null
          prestador_id: string | null
          provincia: string | null
          publicado: boolean | null
          telefone_whatsapp: string | null
          tipo_destaque: string | null
          tipo_servico: string | null
          vendedor_id: string | null
          visualizacoes: number | null
          zona_atuacao: string | null
        }
        Insert: {
          atualizado_em?: string | null
          categoria_id?: string | null
          cliques_whatsapp?: number | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          destaque_ate?: string | null
          destaque_inicio?: string | null
          disponivel?: boolean | null
          id?: string
          imagem_url?: string | null
          municipio?: string | null
          nome_prestador?: string | null
          nome_servico: string
          preco_estimado?: number | null
          prestador_id?: string | null
          provincia?: string | null
          publicado?: boolean | null
          telefone_whatsapp?: string | null
          tipo_destaque?: string | null
          tipo_servico?: string | null
          vendedor_id?: string | null
          visualizacoes?: number | null
          zona_atuacao?: string | null
        }
        Update: {
          atualizado_em?: string | null
          categoria_id?: string | null
          cliques_whatsapp?: number | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          destaque_ate?: string | null
          destaque_inicio?: string | null
          disponivel?: boolean | null
          id?: string
          imagem_url?: string | null
          municipio?: string | null
          nome_prestador?: string | null
          nome_servico?: string
          preco_estimado?: number | null
          prestador_id?: string | null
          provincia?: string | null
          publicado?: boolean | null
          telefone_whatsapp?: string | null
          tipo_destaque?: string | null
          tipo_servico?: string | null
          vendedor_id?: string | null
          visualizacoes?: number | null
          zona_atuacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategorias_produto: {
        Row: {
          categoria_id: string
          criado_em: string
          id: string
          nome: string
          ordem_exibicao: number
          slug: string
        }
        Insert: {
          categoria_id: string
          criado_em?: string
          id?: string
          nome: string
          ordem_exibicao: number
          slug: string
        }
        Update: {
          categoria_id?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem_exibicao?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_produto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      tentativas_pagamento: {
        Row: {
          atualizado_em: string
          cancelado_em: string | null
          chave_idempotencia: string
          codigo_erro: string | null
          confirmado_em: string | null
          criado_em: string
          estado: string
          expirado_em: string | null
          falhado_em: string | null
          id: string
          iniciado_em: string
          mensagem_erro: string | null
          metadados: Json
          metodo: string
          pagamento_id: string
          provedor: string | null
          referencia_externa: string | null
          referencia_interna: string
        }
        Insert: {
          atualizado_em?: string
          cancelado_em?: string | null
          chave_idempotencia: string
          codigo_erro?: string | null
          confirmado_em?: string | null
          criado_em?: string
          estado?: string
          expirado_em?: string | null
          falhado_em?: string | null
          id?: string
          iniciado_em?: string
          mensagem_erro?: string | null
          metadados?: Json
          metodo: string
          pagamento_id: string
          provedor?: string | null
          referencia_externa?: string | null
          referencia_interna: string
        }
        Update: {
          atualizado_em?: string
          cancelado_em?: string | null
          chave_idempotencia?: string
          codigo_erro?: string | null
          confirmado_em?: string | null
          criado_em?: string
          estado?: string
          expirado_em?: string | null
          falhado_em?: string | null
          id?: string
          iniciado_em?: string
          mensagem_erro?: string | null
          metadados?: Json
          metodo?: string
          pagamento_id?: string
          provedor?: string | null
          referencia_externa?: string | null
          referencia_interna?: string
        }
        Relationships: [
          {
            foreignKeyName: "tentativas_pagamento_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos_entrega: {
        Row: {
          aceita_paletes: boolean
          ano: number | null
          atualizado_em: string
          capacidade_kg: number
          capacidade_volume_m3: number | null
          cor: string
          criado_em: string
          estado_verificacao: string
          foto_veiculo_path: string | null
          id: string
          marca: string
          matricula: string
          modelo: string
          motivo_rejeicao: string | null
          parceiro_id: string
          possui_caixa_carga: boolean
          possui_refrigeracao: boolean
          tipo_carrocaria: string | null
          tipo_veiculo: string
        }
        Insert: {
          aceita_paletes?: boolean
          ano?: number | null
          atualizado_em?: string
          capacidade_kg: number
          capacidade_volume_m3?: number | null
          cor: string
          criado_em?: string
          estado_verificacao?: string
          foto_veiculo_path?: string | null
          id?: string
          marca: string
          matricula: string
          modelo: string
          motivo_rejeicao?: string | null
          parceiro_id: string
          possui_caixa_carga?: boolean
          possui_refrigeracao?: boolean
          tipo_carrocaria?: string | null
          tipo_veiculo: string
        }
        Update: {
          aceita_paletes?: boolean
          ano?: number | null
          atualizado_em?: string
          capacidade_kg?: number
          capacidade_volume_m3?: number | null
          cor?: string
          criado_em?: string
          estado_verificacao?: string
          foto_veiculo_path?: string | null
          id?: string
          marca?: string
          matricula?: string
          modelo?: string
          motivo_rejeicao?: string | null
          parceiro_id?: string
          possui_caixa_carga?: boolean
          possui_refrigeracao?: boolean
          tipo_carrocaria?: string | null
          tipo_veiculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_entrega_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          ano_inicio: number | null
          aprovado_em: string | null
          aprovado_por: string | null
          area_cultivada: number | null
          atualizado_em: string | null
          bairro: string | null
          compra_produtores: boolean | null
          conta_ativa: boolean | null
          criado_em: string | null
          data_inicio_atividade: string | null
          descricao: string | null
          documentos: Json
          email: string | null
          email_login: string | null
          endereco_detalhado: string | null
          entrega_disponivel: boolean | null
          entrega_outras_provincias: boolean | null
          foto_perfil: string | null
          horario_atendimento: string | null
          id: string
          indicativo_telefone: string | null
          mercado_bairro: string | null
          mercado_localizado: string | null
          motivo_rejeicao: string | null
          municipio: string | null
          nome_comercial: string
          nome_responsavel: string | null
          plano: string | null
          pode_destacar: boolean | null
          principais_culturas: string | null
          producao_mensal: string | null
          provincia: string | null
          proximo_destaque_produto_em: string | null
          proximo_destaque_servico_em: string | null
          status_aprovacao: string | null
          telefone_nacional: string | null
          telefone_whatsapp: string | null
          tipo_loja: string | null
          tipo_producao: string | null
          tipo_vendedor: string | null
          tipos_produtos: string | null
          user_id: string | null
          venda_grosso: boolean | null
          venda_presencial: boolean | null
          venda_retalho: boolean | null
          verificado: boolean | null
          volume_minimo: string | null
          whatsapp: string | null
        }
        Insert: {
          ano_inicio?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_cultivada?: number | null
          atualizado_em?: string | null
          bairro?: string | null
          compra_produtores?: boolean | null
          conta_ativa?: boolean | null
          criado_em?: string | null
          data_inicio_atividade?: string | null
          descricao?: string | null
          documentos?: Json
          email?: string | null
          email_login?: string | null
          endereco_detalhado?: string | null
          entrega_disponivel?: boolean | null
          entrega_outras_provincias?: boolean | null
          foto_perfil?: string | null
          horario_atendimento?: string | null
          id?: string
          indicativo_telefone?: string | null
          mercado_bairro?: string | null
          mercado_localizado?: string | null
          motivo_rejeicao?: string | null
          municipio?: string | null
          nome_comercial: string
          nome_responsavel?: string | null
          plano?: string | null
          pode_destacar?: boolean | null
          principais_culturas?: string | null
          producao_mensal?: string | null
          provincia?: string | null
          proximo_destaque_produto_em?: string | null
          proximo_destaque_servico_em?: string | null
          status_aprovacao?: string | null
          telefone_nacional?: string | null
          telefone_whatsapp?: string | null
          tipo_loja?: string | null
          tipo_producao?: string | null
          tipo_vendedor?: string | null
          tipos_produtos?: string | null
          user_id?: string | null
          venda_grosso?: boolean | null
          venda_presencial?: boolean | null
          venda_retalho?: boolean | null
          verificado?: boolean | null
          volume_minimo?: string | null
          whatsapp?: string | null
        }
        Update: {
          ano_inicio?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_cultivada?: number | null
          atualizado_em?: string | null
          bairro?: string | null
          compra_produtores?: boolean | null
          conta_ativa?: boolean | null
          criado_em?: string | null
          data_inicio_atividade?: string | null
          descricao?: string | null
          documentos?: Json
          email?: string | null
          email_login?: string | null
          endereco_detalhado?: string | null
          entrega_disponivel?: boolean | null
          entrega_outras_provincias?: boolean | null
          foto_perfil?: string | null
          horario_atendimento?: string | null
          id?: string
          indicativo_telefone?: string | null
          mercado_bairro?: string | null
          mercado_localizado?: string | null
          motivo_rejeicao?: string | null
          municipio?: string | null
          nome_comercial?: string
          nome_responsavel?: string | null
          plano?: string | null
          pode_destacar?: boolean | null
          principais_culturas?: string | null
          producao_mensal?: string | null
          provincia?: string | null
          proximo_destaque_produto_em?: string | null
          proximo_destaque_servico_em?: string | null
          status_aprovacao?: string | null
          telefone_nacional?: string | null
          telefone_whatsapp?: string | null
          tipo_loja?: string | null
          tipo_producao?: string | null
          tipo_vendedor?: string | null
          tipos_produtos?: string | null
          user_id?: string | null
          venda_grosso?: boolean | null
          venda_presencial?: boolean | null
          venda_retalho?: boolean | null
          verificado?: boolean | null
          volume_minimo?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      versoes_documento_parceiro_entrega: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          criado_em: string
          documento_id: string
          estado: string
          frente_path: string
          id: string
          motivo_rejeicao: string | null
          numero_documento_snapshot: string | null
          numero_versao: number
          parceiro_id: string
          substituido_em: string | null
          validade_snapshot: string | null
          veiculo_id: string | null
          verso_path: string
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          criado_em?: string
          documento_id: string
          estado: string
          frente_path: string
          id?: string
          motivo_rejeicao?: string | null
          numero_documento_snapshot?: string | null
          numero_versao: number
          parceiro_id: string
          substituido_em?: string | null
          validade_snapshot?: string | null
          veiculo_id?: string | null
          verso_path: string
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          criado_em?: string
          documento_id?: string
          estado?: string
          frente_path?: string
          id?: string
          motivo_rejeicao?: string | null
          numero_documento_snapshot?: string | null
          numero_versao?: number
          parceiro_id?: string
          substituido_em?: string | null
          validade_snapshot?: string | null
          veiculo_id?: string | null
          verso_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "versoes_documento_parceiro_entrega_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_parceiro_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versoes_documento_parceiro_entrega_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versoes_documento_parceiro_entrega_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      visualizacoes_produtos: {
        Row: {
          cliente_id: string | null
          criado_em: string | null
          id: string
          produto_id: string | null
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          produto_id?: string | null
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          produto_id?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visualizacoes_produtos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visualizacoes_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visualizacoes_produtos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      visualizacoes_servicos: {
        Row: {
          cliente_id: string | null
          criado_em: string | null
          id: string
          servico_id: string | null
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          servico_id?: string | null
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          criado_em?: string | null
          id?: string
          servico_id?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visualizacoes_servicos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visualizacoes_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visualizacoes_servicos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_disputa_encomenda: {
        Args: {
          p_descricao: string
          p_encomenda_id: string
          p_tipo_problema: string
          p_valor_reclamado_centimos?: number
        }
        Returns: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          cliente_id: string
          criado_em: string
          decisao: string | null
          descricao: string
          encomenda_id: string
          estado: string
          id: string
          observacao_resolucao: string | null
          pagamento_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo_problema: string
          valor_reclamado_centimos: number | null
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "disputas_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aceitar_atribuicao_entrega: {
        Args: { p_atribuicao_id: string }
        Returns: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "atribuicoes_entrega_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apagar_minha_conta: { Args: never; Returns: undefined }
      aprovar_parceiro_entrega_admin: {
        Args: { p_parceiro_id: string }
        Returns: {
          aprovado_em: string | null
          atualizado_em: string
          bairro: string | null
          contacto_emergencia: string
          criado_em: string
          disponibilidade: boolean
          email: string | null
          estado: string
          foto_perfil_url: string | null
          id: string
          indicativo_telefone: string | null
          motivo_rejeicao: string | null
          motivo_suspensao: string | null
          municipio: string
          nome_completo: string
          provincia: string
          telefone: string
          telefone_nacional: string | null
          termos_aceites_em: string
          user_id: string
          zona_base: string | null
        }
        SetofOptions: {
          from: "*"
          to: "parceiros_entrega"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assumir_disputa_admin: {
        Args: { p_disputa_id: string }
        Returns: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          cliente_id: string
          criado_em: string
          decisao: string | null
          descricao: string
          encomenda_id: string
          estado: string
          id: string
          observacao_resolucao: string | null
          pagamento_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo_problema: string
          valor_reclamado_centimos: number | null
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "disputas_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atribuir_entregador_encomenda: {
        Args: {
          p_encomenda_id: string
          p_parceiro_id: string
          p_veiculo_id: string
        }
        Returns: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "atribuicoes_entrega_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atualizar_area_cobertura_entrega: {
        Args: {
          p_area_id: string
          p_ativo?: boolean
          p_bairro?: string
          p_municipio: string
          p_provincia: string
        }
        Returns: {
          ativo: boolean
          bairro: string | null
          criado_em: string
          id: string
          municipio: string
          parceiro_id: string
          provincia: string
        }
        SetofOptions: {
          from: "*"
          to: "areas_cobertura_entrega"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atualizar_estado_prestador_servico_admin: {
        Args: { p_estado: string; p_prestador_id: string }
        Returns: undefined
      }
      atualizar_estado_vendedor_admin: {
        Args: {
          p_estado: string
          p_motivo_rejeicao?: string
          p_vendedor_id: string
        }
        Returns: undefined
      }
      atualizar_plano_vendedor_admin: {
        Args: { p_plano: string; p_vendedor_id: string }
        Returns: undefined
      }
      atualizar_verificacao_prestador_servico_admin: {
        Args: { p_prestador_id: string; p_verificado: boolean }
        Returns: undefined
      }
      atualizar_verificacao_vendedor_admin: {
        Args: { p_vendedor_id: string; p_verificado: boolean }
        Returns: undefined
      }
      avaliar_compatibilidade_veiculo_encomenda: {
        Args: { p_encomenda_id: string; p_veiculo_id: string }
        Returns: {
          estado: string
          motivos: string[]
        }[]
      }
      calcular_hash_intencao_checkout: {
        Args: { p_intencao: Json }
        Returns: string
      }
      calcular_requisitos_logisticos_encomenda: {
        Args: { p_encomenda_id: string }
        Returns: {
          peso_total_conhecido: boolean
          peso_total_kg: number
          requer_caixa_carga: boolean
          requer_paletes: boolean
          requer_refrigeracao: boolean
          requisitos_especiais_conhecidos: boolean
          volume_total_conhecido: boolean
          volume_total_m3: number
        }[]
      }
      calcular_valores_financeiros_efetivos: {
        Args: { p_pagamento_id: string }
        Returns: {
          base_comissionavel_centimos: number
          comissao_efetiva_centimos: number
          pagamento_id: string
          reembolso_total_aprovado_centimos: number
          reembolsos_produtos_centimos: number
          valor_logistica_efetivo_centimos: number
          valor_vendedor_efetivo_centimos: number
        }[]
      }
      confirmar_chegada_destino_entregador: {
        Args: { p_atribuicao_id: string }
        Returns: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "atribuicoes_entrega_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirmar_chegada_origem_entregador: {
        Args: { p_atribuicao_id: string }
        Returns: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "atribuicoes_entrega_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirmar_recolha_encomenda_vendedor: {
        Args: { p_atribuicao_id: string }
        Returns: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "atribuicoes_entrega_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consultar_estado_codigo_levantamento_admin: {
        Args: { p_encomenda_id: string }
        Returns: {
          atualizado_em: string
          bloqueado_em: string
          criado_em: string
          encomenda_id: string
          expira_em: string
          geracoes: number
          max_tentativas: number
          tentativas: number
          usado_em: string
        }[]
      }
      contar_notificacoes_nao_lidas: { Args: never; Returns: number }
      criar_area_cobertura_entrega: {
        Args: { p_bairro?: string; p_municipio: string; p_provincia: string }
        Returns: {
          ativo: boolean
          bairro: string | null
          criado_em: string
          id: string
          municipio: string
          parceiro_id: string
          provincia: string
        }
        SetofOptions: {
          from: "*"
          to: "areas_cobertura_entrega"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      criar_encomenda_entrega:
        | {
            Args: {
              p_bairro: string
              p_destinatario_nome: string
              p_destinatario_telefone: string
              p_endereco_detalhado: string
              p_instrucoes_entrega?: string
              p_itens: Json
              p_municipio: string
              p_observacoes?: string
              p_ponto_referencia?: string
              p_provincia: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_bairro: string
              p_destinatario_nome: string
              p_destinatario_telefone: string
              p_endereco_detalhado: string
              p_idempotency_key: string
              p_instrucoes_entrega: string
              p_itens: Json
              p_municipio: string
              p_observacoes: string
              p_ponto_referencia: string
              p_provincia: string
            }
            Returns: Json
          }
      criar_encomenda_entrega_base_v1: {
        Args: {
          p_bairro: string
          p_destinatario_nome: string
          p_destinatario_telefone: string
          p_endereco_detalhado: string
          p_instrucoes_entrega?: string
          p_itens: Json
          p_municipio: string
          p_observacoes?: string
          p_ponto_referencia?: string
          p_provincia: string
        }
        Returns: Json
      }
      criar_encomenda_levantamento:
        | {
            Args: {
              p_itens: Json
              p_modalidade?: string
              p_nome_destinatario?: string
              p_observacoes_cliente?: string
              p_telefone_destinatario?: string
            }
            Returns: {
              atualizado_em: string
              bairro: string | null
              cancelado_em: string | null
              cliente_id: string
              codigo_publico: string
              concluido_em: string | null
              confirmado_em: string | null
              criado_em: string
              desconto_centimos: number
              destinatario_nome: string
              destinatario_telefone: string
              endereco_levantamento: string | null
              entrega_centimos: number
              estado: string
              id: string
              modalidade_recebimento: string
              moeda: string
              motivo_cancelamento: string | null
              motivo_recusa: string | null
              municipio: string | null
              observacoes_cliente: string | null
              ponto_referencia: string | null
              provincia: string | null
              recusado_em: string | null
              subtotal_centimos: number
              total_centimos: number
              vendedor_id: string
            }
            SetofOptions: {
              from: "*"
              to: "encomendas"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_idempotency_key: string
              p_itens: Json
              p_modalidade: string
              p_nome_destinatario: string
              p_observacoes_cliente: string
              p_telefone_destinatario: string
            }
            Returns: {
              atualizado_em: string
              bairro: string | null
              cancelado_em: string | null
              cliente_id: string
              codigo_publico: string
              concluido_em: string | null
              confirmado_em: string | null
              criado_em: string
              desconto_centimos: number
              destinatario_nome: string
              destinatario_telefone: string
              endereco_levantamento: string | null
              entrega_centimos: number
              estado: string
              id: string
              modalidade_recebimento: string
              moeda: string
              motivo_cancelamento: string | null
              motivo_recusa: string | null
              municipio: string | null
              observacoes_cliente: string | null
              ponto_referencia: string | null
              provincia: string | null
              recusado_em: string | null
              subtotal_centimos: number
              total_centimos: number
              vendedor_id: string
            }
            SetofOptions: {
              from: "*"
              to: "encomendas"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      criar_encomenda_levantamento_base_v1: {
        Args: {
          p_itens: Json
          p_modalidade?: string
          p_nome_destinatario?: string
          p_observacoes_cliente?: string
          p_telefone_destinatario?: string
        }
        Returns: {
          atualizado_em: string
          bairro: string | null
          cancelado_em: string | null
          cliente_id: string
          codigo_publico: string
          concluido_em: string | null
          confirmado_em: string | null
          criado_em: string
          desconto_centimos: number
          destinatario_nome: string
          destinatario_telefone: string
          endereco_levantamento: string | null
          entrega_centimos: number
          estado: string
          id: string
          modalidade_recebimento: string
          moeda: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          municipio: string | null
          observacoes_cliente: string | null
          ponto_referencia: string | null
          provincia: string | null
          recusado_em: string | null
          subtotal_centimos: number
          total_centimos: number
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "encomendas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      criar_notificacao: {
        Args: {
          p_chave?: string
          p_contexto: string
          p_entidade_id?: string
          p_entidade_tipo?: string
          p_mensagem: string
          p_metadata?: Json
          p_tipo: string
          p_titulo: string
          p_url_destino?: string
          p_utilizador_id: string
        }
        Returns: string
      }
      criar_pagamento_encomenda: {
        Args: { p_chave_idempotencia: string; p_encomenda_id: string }
        Returns: {
          atualizado_em: string
          cancelado_em: string | null
          chave_idempotencia_criacao: string
          cliente_id: string
          comissao_angrolink_centimos: number
          comissao_bps_snapshot: number
          confirmado_em: string | null
          criado_em: string
          desconto_centimos: number
          encomenda_id: string
          entrega_centimos: number
          estado: string
          expirado_em: string | null
          falhado_em: string | null
          id: string
          moeda: string
          referencia_interna: string
          subtotal_centimos: number
          taxa_processador_centimos: number
          total_cliente_centimos: number
          valor_logistica_centimos: number
          valor_total_centimos: number
          valor_vendedor_centimos: number
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pagamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      criar_pedido_parceiro_entrega: {
        Args: {
          p_area: Json
          p_dados: Json
          p_documentos: Json
          p_veiculo: Json
        }
        Returns: string
      }
      criar_tentativa_pagamento: {
        Args: {
          p_chave_idempotencia: string
          p_metodo: string
          p_pagamento_id: string
        }
        Returns: {
          atualizado_em: string
          cancelado_em: string | null
          chave_idempotencia: string
          codigo_erro: string | null
          confirmado_em: string | null
          criado_em: string
          estado: string
          expirado_em: string | null
          falhado_em: string | null
          id: string
          iniciado_em: string
          mensagem_erro: string | null
          metadados: Json
          metodo: string
          pagamento_id: string
          provedor: string | null
          referencia_externa: string | null
          referencia_interna: string
        }
        SetofOptions: {
          from: "*"
          to: "tentativas_pagamento"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      desativar_minha_conta: { Args: never; Returns: undefined }
      destacar_produto_gratis: {
        Args: { produto_uuid: string }
        Returns: undefined
      }
      destacar_servico_gratis: {
        Args: { servico_uuid: string }
        Returns: undefined
      }
      destino_entrega_eh_operacional_fase1: {
        Args: { p_municipio: string; p_provincia: string }
        Returns: boolean
      }
      documentos_obrigatorios_vendedor_fase1: {
        Args: { p_tipo_vendedor: string }
        Returns: string[]
      }
      eh_admin: { Args: never; Returns: boolean }
      eliminar_vendedor_admin: {
        Args: { p_vendedor_id: string }
        Returns: undefined
      }
      encomenda_tem_disputa_ativa: {
        Args: { p_encomenda_id: string }
        Returns: boolean
      }
      entregador_pode_receber_entregas: {
        Args: { p_parceiro_id: string }
        Returns: boolean
      }
      enviar_mensagem_encomenda: {
        Args: {
          p_atribuicao_entrega_id?: string
          p_canal?: string
          p_corpo: string
          p_encomenda_id: string
        }
        Returns: string
      }
      expirar_destaques_antigos: { Args: never; Returns: undefined }
      garantir_perfil_comprador: {
        Args: never
        Returns: {
          atualizado_em: string | null
          conta_ativa: boolean | null
          criado_em: string | null
          email: string | null
          email_login: string | null
          foto_perfil: string | null
          id: string
          indicativo_telefone: string | null
          municipio: string | null
          nome: string | null
          provincia: string | null
          telefone: string | null
          telefone_nacional: string | null
          tipo_comprador: string | null
        }
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gerar_codigo_publico_encomenda: { Args: never; Returns: string }
      gerar_otp_entrega_aleatorio: { Args: never; Returns: string }
      gerar_otp_levantamento_aleatorio: { Args: never; Returns: string }
      gerar_referencia_pagamento_interna: { Args: never; Returns: string }
      gerar_referencia_tentativa_pagamento_interna: {
        Args: never
        Returns: string
      }
      hash_intervencao_entrega_admin: {
        Args: { p_payload: Json }
        Returns: string
      }
      incrementar_clique_whatsapp_produto: {
        Args: { produto_id_param: string }
        Returns: undefined
      }
      incrementar_clique_whatsapp_servico: {
        Args: { servico_id_param: string }
        Returns: undefined
      }
      incrementar_visualizacao_produto: {
        Args: { produto_id_param: string }
        Returns: undefined
      }
      incrementar_visualizacao_servico: {
        Args: { servico_id_param: string }
        Returns: undefined
      }
      interacao_comercial_produto_permitida: {
        Args: { p_produto_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_atual: { Args: never; Returns: boolean }
      is_dono_vendedor: { Args: { vendedor_uuid: string }; Returns: boolean }
      is_vendedor_aprovado: {
        Args: { vendedor_uuid: string }
        Returns: boolean
      }
      is_vendedor_publico_aprovado: {
        Args: { vendedor_uuid: string }
        Returns: boolean
      }
      libertar_atribuicao_entrega_admin: {
        Args: {
          p_atribuicao_id: string
          p_chave_idempotencia: string
          p_motivo: string
        }
        Returns: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "atribuicoes_entrega_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      listar_areas_cobertura_entregador_admin: {
        Args: { p_limite?: number; p_offset?: number; p_parceiro_id: string }
        Returns: Json
      }
      listar_categorias_produto_operacionais: {
        Args: { p_provincia_id: string }
        Returns: {
          aviso_visual: string
          categoria_id: string
          estado: string
          nome: string
          requer_revisao_admin: boolean
        }[]
      }
      listar_compatibilidade_logistica_encomenda_admin: {
        Args: { p_encomenda_id: string }
        Returns: {
          aceita_paletes: boolean
          areas_cobertura: Json
          capacidade_kg: number
          capacidade_volume_m3: number
          estado: string
          matricula: string
          motivos: string[]
          parceiro_id: string
          parceiro_nome: string
          possui_caixa_carga: boolean
          possui_refrigeracao: boolean
          tipo_veiculo: string
          veiculo_id: string
        }[]
      }
      listar_compradores_admin: {
        Args: {
          p_com_cancelamentos?: boolean
          p_com_disputas?: boolean
          p_conta_ativa?: boolean
          p_limite?: number
          p_municipio?: string
          p_offset?: number
          p_pesquisa?: string
          p_provincia?: string
          p_registo_recente?: boolean
          p_tipo_comprador?: string
        }
        Returns: Json
      }
      listar_contactos_produtos_vendedor: {
        Args: never
        Returns: {
          atualizado_em: string
          cliente_id: string
          clientes: Json
          criado_em: string
          id: string
          produto_id: string
          produtos: Json
          vendedor_id: string
        }[]
      }
      listar_contactos_servicos_vendedor: {
        Args: never
        Returns: {
          atualizado_em: string
          cliente_id: string
          clientes: Json
          criado_em: string
          id: string
          servico_id: string
          servicos: Json
          vendedor_id: string
        }[]
      }
      listar_disputas_admin: {
        Args: { p_estado?: string }
        Returns: {
          atualizado_em: string
          cliente_nome: string
          codigo_publico: string
          criado_em: string
          descricao_resumida: string
          disputa_id: string
          encomenda_id: string
          estado: string
          pagamento_id: string
          responsavel_admin_id: string
          tipo_problema: string
          valor_reclamado_centimos: number
          vendedor_nome: string
        }[]
      }
      listar_disputas_vendedor_admin: {
        Args: { p_limite?: number; p_offset?: number; p_vendedor_id: string }
        Returns: Json
      }
      listar_documentos_entregador_admin: {
        Args: { p_limite?: number; p_offset?: number; p_parceiro_id: string }
        Returns: Json
      }
      listar_encomendas_admin: {
        Args: {
          p_ate?: string
          p_cliente_id?: string
          p_com_disputa?: boolean
          p_de?: string
          p_estado?: string
          p_estado_pagamento?: string
          p_vendedor_id?: string
        }
        Returns: {
          atualizado_em: string
          cliente_id: string
          cliente_nome: string
          codigo_publico: string
          criado_em: string
          desconto_centimos: number
          encomenda_id: string
          entrega_centimos: number
          estado: string
          estado_pagamento: string
          modalidade: string
          quantidade_itens: number
          subtotal_centimos: number
          tem_disputa: boolean
          total_centimos: number
          vendedor_id: string
          vendedor_nome: string
        }[]
      }
      listar_encomendas_vendedor_admin: {
        Args: { p_limite?: number; p_offset?: number; p_vendedor_id: string }
        Returns: Json
      }
      listar_entregas_parceiro_admin: {
        Args: { p_limite?: number; p_offset?: number; p_parceiro_id: string }
        Returns: Json
      }
      listar_financeiro_admin: {
        Args: never
        Returns: {
          cliente_nome: string
          codigo_publico: string
          comissao_efetiva_centimos: number
          comissao_snapshot_centimos: number
          criado_em: string
          desconto_centimos: number
          encomenda_id: string
          entrega_centimos: number
          estado_pagamento: string
          estado_repasse: string
          metodo: string
          pagamento_id: string
          referencia_interna: string
          subtotal_centimos: number
          total_centimos: number
          total_reembolsado_centimos: number
          valor_vendedor_efetivo_centimos: number
          valor_vendedor_snapshot_centimos: number
          vendedor_nome: string
        }[]
      }
      listar_historico_documental_entregador_admin: {
        Args: { p_limite?: number; p_offset?: number; p_parceiro_id: string }
        Returns: Json
      }
      listar_historico_documental_vendedor_admin: {
        Args: { p_limite?: number; p_offset?: number; p_vendedor_id: string }
        Returns: Json
      }
      listar_mensagens_encomenda: {
        Args: {
          p_antes_de?: string
          p_antes_id?: string
          p_atribuicao_entrega_id?: string
          p_canal?: string
          p_encomenda_id: string
          p_limite?: number
        }
        Returns: {
          corpo: string
          criado_em: string
          encomenda_id: string
          mensagem_id: string
          remetente_user_id: string
        }[]
      }
      listar_municipios_angola: {
        Args: { p_provincia_id: string }
        Returns: {
          codigo_oficial: string
          id: string
          nome: string
          provincia_id: string
        }[]
      }
      listar_notificacoes: {
        Args: { p_antes_de?: string; p_limite?: number }
        Returns: {
          chave_idempotencia: string | null
          contexto: string
          criado_em: string
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          lida: boolean
          lida_em: string | null
          mensagem: string
          metadata: Json
          tipo: string
          titulo: string
          url_destino: string | null
          utilizador_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notificacoes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      listar_pagamentos_cliente: {
        Args: never
        Returns: {
          confirmado_em: string
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          moeda: string
          referencia_interna: string
          total_cliente_centimos: number
        }[]
      }
      listar_prestadores_servico_admin: {
        Args: never
        Returns: {
          atualizado_em: string
          conta_ativa: boolean
          criado_em: string
          descricao: string
          email: string
          foto_url: string
          id: string
          municipio: string
          nome_publico: string
          provincia: string
          status_aprovacao: string
          telefone_whatsapp: string
          tipo_prestador: string
          user_id: string
          verificado: boolean
        }[]
      }
      listar_prestadores_servicos_publicos: {
        Args: { p_prestador_ids?: string[] }
        Returns: {
          criado_em: string
          descricao: string
          foto_url: string
          id: string
          municipio: string
          nome_publico: string
          provincia: string
          telefone_whatsapp: string
          tipo_prestador: string
          verificado: boolean
        }[]
      }
      listar_produtos_publicos_fase1: {
        Args: {
          p_categoria_id?: string
          p_categoria_ids?: string[]
          p_excluir_produto_id?: string
          p_limite?: number
          p_localizacao_ou?: boolean
          p_municipio?: string
          p_ordenar_por_destaque?: boolean
          p_pesquisa?: string
          p_produto_id?: string
          p_produto_ids?: string[]
          p_provincia?: string
          p_vendedor_id?: string
        }
        Returns: Json[]
      }
      listar_produtos_vendedor_admin: {
        Args: { p_limite?: number; p_offset?: number; p_vendedor_id: string }
        Returns: Json
      }
      listar_provincias_angola: {
        Args: never
        Returns: {
          codigo_oficial: string
          id: string
          nome: string
          ordem: number
        }[]
      }
      listar_resumo_financeiro_vendedor: {
        Args: never
        Returns: {
          disponivel_em: string
          encomenda_id: string
          estado_pagamento: string
          estado_repasse: string
          moeda: string
          pagamento_id: string
          processado_em: string
          referencia_interna: string
          valor_repasse_centimos: number
          valor_vendedor_centimos: number
        }[]
      }
      listar_servicos_vendedor_admin: {
        Args: { p_limite?: number; p_offset?: number; p_vendedor_id: string }
        Returns: Json
      }
      listar_subcategorias_produto_operacionais: {
        Args: { p_categoria_id: string; p_provincia_id: string }
        Returns: {
          aviso_visual: string
          categoria_id: string
          estado: string
          nome: string
          ordem_exibicao: number
          requer_revisao_admin: boolean
          slug: string
          subcategoria_id: string
        }[]
      }
      listar_tarefas_entregador: {
        Args: never
        Returns: {
          aceite_em: string
          atribuido_em: string
          codigo_publico: string
          destino: Json
          encomenda_id: string
          estado: string
          id: string
          matricula: string
          motivo_recusa: string
          origem: Json
          quantidade_itens: number
          recusado_em: string
          requisitos_logisticos: Json
          tipo_veiculo: string
        }[]
      }
      listar_utilizadores_admin: {
        Args: {
          p_estado?: string
          p_limite?: number
          p_offset?: number
          p_papel?: string
          p_pesquisa?: string
          p_provincia?: string
          p_registo_recente?: boolean
        }
        Returns: Json
      }
      listar_veiculos_compativeis_encomenda: {
        Args: { p_encomenda_id: string }
        Returns: {
          parceiro_id: string
          veiculo_id: string
        }[]
      }
      listar_veiculos_entregador_admin: {
        Args: { p_limite?: number; p_offset?: number; p_parceiro_id: string }
        Returns: Json
      }
      listar_vendedores_admin: {
        Args: never
        Returns: {
          aprovado_em: string
          aprovado_por: string
          atualizado_em: string
          bairro: string
          conta_ativa: boolean
          criado_em: string
          descricao: string
          email: string
          email_login: string
          endereco_detalhado: string
          foto_perfil: string
          id: string
          indicativo_telefone: string
          mercado_bairro: string
          motivo_rejeicao: string
          municipio: string
          nome_comercial: string
          nome_responsavel: string
          plano: string
          pode_destacar: boolean
          provincia: string
          status_aprovacao: string
          telefone_nacional: string
          telefone_whatsapp: string
          tipo_vendedor: string
          user_id: string
          verificado: boolean
          whatsapp: string
        }[]
      }
      listar_vendedores_publicos: {
        Args: { p_vendedor_ids?: string[] }
        Returns: {
          ano_inicio: number
          area_cultivada: number
          bairro: string
          compra_produtores: boolean
          criado_em: string
          data_inicio_atividade: string
          descricao: string
          endereco_detalhado: string
          entrega_disponivel: boolean
          entrega_outras_provincias: boolean
          foto_perfil: string
          horario_atendimento: string
          id: string
          mercado_bairro: string
          mercado_localizado: string
          municipio: string
          nome_comercial: string
          principais_culturas: string
          producao_mensal: string
          provincia: string
          telefone_whatsapp: string
          tipo_loja: string
          tipo_producao: string
          tipo_vendedor: string
          tipos_produtos: string
          venda_grosso: boolean
          venda_presencial: boolean
          venda_retalho: boolean
          verificado: boolean
          volume_minimo: string
          whatsapp: string
        }[]
      }
      marcar_mensagens_encomenda_como_lidas: {
        Args: {
          p_atribuicao_entrega_id?: string
          p_canal?: string
          p_encomenda_id: string
        }
        Returns: undefined
      }
      marcar_notificacao_como_lida: {
        Args: { p_notificacao_id: string }
        Returns: undefined
      }
      marcar_todas_notificacoes_como_lidas: { Args: never; Returns: undefined }
      motivos_compatibilidade_veiculo_encomenda: {
        Args: { p_encomenda_id: string; p_veiculo_id: string }
        Returns: string[]
      }
      motivos_elegibilidade_entregador: {
        Args: { p_parceiro_id: string }
        Returns: string[]
      }
      motivos_operacionais_veiculo_entrega: {
        Args: { p_veiculo_id: string }
        Returns: string[]
      }
      normalizar_itens_checkout_idempotencia: {
        Args: { p_itens: Json }
        Returns: Json
      }
      normalizar_texto_territorial: {
        Args: { p_texto: string }
        Returns: string
      }
      obter_atribuicao_entrega_encomenda_admin: {
        Args: { p_encomenda_id: string }
        Returns: Json
      }
      obter_codigo_entrega_cliente: {
        Args: { p_encomenda_id: string }
        Returns: {
          codigo: string
          expira_em: string
          geracoes: number
        }[]
      }
      obter_codigo_levantamento_cliente: {
        Args: { p_encomenda_id: string }
        Returns: {
          codigo: string
          expira_em: string
          geracoes: number
        }[]
      }
      obter_comprador_admin: { Args: { p_cliente_id: string }; Returns: Json }
      obter_disputa_admin: { Args: { p_disputa_id: string }; Returns: Json }
      obter_documentos_legados_vendedor: {
        Args: { p_vendedor_id: string }
        Returns: Json
      }
      obter_elegibilidade_entregador_admin: {
        Args: { p_parceiro_id: string }
        Returns: Json
      }
      obter_encomenda_admin: { Args: { p_encomenda_id: string }; Returns: Json }
      obter_entrega_encomenda_participante: {
        Args: { p_encomenda_id: string }
        Returns: Json
      }
      obter_entregador_admin: { Args: { p_parceiro_id: string }; Returns: Json }
      obter_estado_levantamento_participante: {
        Args: { p_encomenda_id: string }
        Returns: Json
      }
      obter_estado_operacional_catalogo_produto: {
        Args: {
          p_categoria_id: string
          p_provincia_id: string
          p_subcategoria_id?: string
        }
        Returns: {
          aviso_visual: string
          estado: string
          requer_revisao_admin: boolean
        }[]
      }
      obter_incidente_operacional_entrega_admin: {
        Args: { p_encomenda_id: string }
        Returns: Json
      }
      obter_meu_prestador_servico: {
        Args: never
        Returns: {
          atualizado_em: string
          conta_ativa: boolean
          criado_em: string
          descricao: string
          email: string
          foto_url: string
          id: string
          municipio: string
          nome_publico: string
          provincia: string
          status_aprovacao: string
          telefone_whatsapp: string
          tipo_prestador: string
          user_id: string
          verificado: boolean
        }[]
      }
      obter_meu_vendedor: {
        Args: never
        Returns: {
          ano_inicio: number
          aprovado_em: string
          area_cultivada: number
          atualizado_em: string
          bairro: string
          compra_produtores: boolean
          conta_ativa: boolean
          criado_em: string
          data_inicio_atividade: string
          descricao: string
          email: string
          endereco_detalhado: string
          entrega_disponivel: boolean
          entrega_outras_provincias: boolean
          foto_perfil: string
          horario_atendimento: string
          id: string
          indicativo_telefone: string
          mercado_bairro: string
          mercado_localizado: string
          motivo_rejeicao: string
          municipio: string
          nome_comercial: string
          nome_responsavel: string
          plano: string
          pode_destacar: boolean
          principais_culturas: string
          producao_mensal: string
          provincia: string
          status_aprovacao: string
          telefone_nacional: string
          telefone_whatsapp: string
          tipo_loja: string
          tipo_producao: string
          tipo_vendedor: string
          tipos_produtos: string
          user_id: string
          venda_grosso: boolean
          venda_presencial: boolean
          venda_retalho: boolean
          verificado: boolean
          volume_minimo: string
          whatsapp: string
        }[]
      }
      obter_pagamento_encomenda_cliente: {
        Args: { p_encomenda_id: string }
        Returns: {
          confirmado_em: string
          criado_em: string
          encomenda_id: string
          estado_pagamento: string
          metodo_pagamento: string
          moeda: string
          pagamento_id: string
          referencia_interna: string
          total_cliente_centimos: number
        }[]
      }
      obter_resumo_entregas_parceiro_admin: {
        Args: { p_parceiro_id: string }
        Returns: Json
      }
      obter_resumo_financeiro_encomenda_vendedor: {
        Args: { p_encomenda_id: string }
        Returns: {
          base_comercial_centimos: number
          comissao_angrolink_centimos: number
          desconto_centimos: number
          encomenda_id: string
          entrega_centimos: number
          estado_pagamento: string
          estado_repasse: string
          moeda: string
          pagamento_id: string
          subtotal_centimos: number
          valor_vendedor_centimos: number
        }[]
      }
      obter_resumo_financeiro_parceiro_admin: {
        Args: { p_parceiro_id: string }
        Returns: Json
      }
      obter_resumo_mensagens_encomenda: {
        Args: {
          p_atribuicao_entrega_id?: string
          p_canal?: string
          p_encomenda_id: string
        }
        Returns: Json
      }
      obter_tarefa_entregador: {
        Args: { p_atribuicao_id: string }
        Returns: Json
      }
      obter_vendedor_admin: { Args: { p_vendedor_id: string }; Returns: Json }
      produto_eh_operacional_fase1: {
        Args: {
          p_categoria_id: string
          p_provincia_texto: string
          p_subcategoria_id: string
          p_vendedor_id: string
        }
        Returns: boolean
      }
      recusar_atribuicao_entrega: {
        Args: { p_atribuicao_id: string; p_motivo: string }
        Returns: {
          aceite_em: string | null
          atribuido_em: string
          atribuido_por: string
          atualizado_em: string
          cancelado_em: string | null
          chegou_destino_em: string | null
          chegou_origem_em: string | null
          concluido_em: string | null
          criado_em: string
          encomenda_id: string
          estado: string
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          parceiro_entrega_id: string
          recolhida_em: string | null
          recusado_em: string | null
          veiculo_id: string
        }
        SetofOptions: {
          from: "*"
          to: "atribuicoes_entrega_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reenviar_documento_parceiro:
        | {
            Args: {
              p_documento_id: string
              p_frente_path: string
              p_verso_path: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_documento_id: string
              p_frente_path: string
              p_numero_documento: string
              p_validade: string
              p_verso_path: string
            }
            Returns: undefined
          }
      registar_incidente_operacional_entrega_admin: {
        Args: {
          p_atribuicao_id: string
          p_chave_idempotencia: string
          p_motivo: string
          p_tipo: string
        }
        Returns: {
          atribuicao_id: string
          atualizado_em: string
          criado_em: string
          criado_por: string
          encomenda_id: string
          estado: string
          id: string
          motivo: string
          observacao_resolucao: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "incidentes_operacionais_entrega"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registar_pagamento_na_entrega_entregador: {
        Args: { p_atribuicao_id: string }
        Returns: {
          atualizado_em: string
          cancelado_em: string | null
          chave_idempotencia_criacao: string
          cliente_id: string
          comissao_angrolink_centimos: number
          comissao_bps_snapshot: number
          confirmado_em: string | null
          criado_em: string
          desconto_centimos: number
          encomenda_id: string
          entrega_centimos: number
          estado: string
          expirado_em: string | null
          falhado_em: string | null
          id: string
          moeda: string
          referencia_interna: string
          subtotal_centimos: number
          taxa_processador_centimos: number
          total_cliente_centimos: number
          valor_logistica_centimos: number
          valor_total_centimos: number
          valor_vendedor_centimos: number
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pagamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registar_pagamento_no_levantamento_vendedor: {
        Args: { p_encomenda_id: string }
        Returns: {
          atualizado_em: string
          cancelado_em: string | null
          chave_idempotencia_criacao: string
          cliente_id: string
          comissao_angrolink_centimos: number
          comissao_bps_snapshot: number
          confirmado_em: string | null
          criado_em: string
          desconto_centimos: number
          encomenda_id: string
          entrega_centimos: number
          estado: string
          expirado_em: string | null
          falhado_em: string | null
          id: string
          moeda: string
          referencia_interna: string
          subtotal_centimos: number
          taxa_processador_centimos: number
          total_cliente_centimos: number
          valor_logistica_centimos: number
          valor_total_centimos: number
          valor_vendedor_centimos: number
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pagamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remover_area_cobertura_entrega: {
        Args: { p_area_id: string }
        Returns: undefined
      }
      remover_destaque_produto: {
        Args: { produto_uuid: string }
        Returns: undefined
      }
      remover_destaque_servico: {
        Args: { servico_uuid: string }
        Returns: undefined
      }
      resolver_disputa_reembolso_parcial_admin: {
        Args: {
          p_chave_idempotencia: string
          p_disputa_id: string
          p_observacao: string
          p_valor_entrega_centimos: number
          p_valor_produtos_centimos: number
          p_valor_taxa_processador_centimos: number
        }
        Returns: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          cliente_id: string
          criado_em: string
          decisao: string | null
          descricao: string
          encomenda_id: string
          estado: string
          id: string
          observacao_resolucao: string | null
          pagamento_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo_problema: string
          valor_reclamado_centimos: number | null
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "disputas_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolver_disputa_reembolso_total_admin: {
        Args: {
          p_chave_idempotencia: string
          p_disputa_id: string
          p_observacao: string
        }
        Returns: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          cliente_id: string
          criado_em: string
          decisao: string | null
          descricao: string
          encomenda_id: string
          estado: string
          id: string
          observacao_resolucao: string | null
          pagamento_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo_problema: string
          valor_reclamado_centimos: number | null
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "disputas_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolver_disputa_sem_reembolso_admin: {
        Args: { p_disputa_id: string; p_observacao: string }
        Returns: {
          analisado_em: string | null
          analisado_por: string | null
          atualizado_em: string
          cliente_id: string
          criado_em: string
          decisao: string | null
          descricao: string
          encomenda_id: string
          estado: string
          id: string
          observacao_resolucao: string | null
          pagamento_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo_problema: string
          valor_reclamado_centimos: number | null
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "disputas_encomenda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolver_incidente_operacional_entrega_admin: {
        Args: {
          p_chave_idempotencia: string
          p_incidente_id: string
          p_observacao: string
        }
        Returns: {
          atribuicao_id: string
          atualizado_em: string
          criado_em: string
          criado_por: string
          encomenda_id: string
          estado: string
          id: string
          motivo: string
          observacao_resolucao: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "incidentes_operacionais_entrega"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolver_territorio_angola: {
        Args: { p_municipio: string; p_provincia: string }
        Returns: {
          municipio_codigo: string
          municipio_id: string
          municipio_nome: string
          provincia_codigo: string
          provincia_id: string
          provincia_nome: string
        }[]
      }
      submeter_pedido_parceiro_entrega: {
        Args: { p_parceiro_id: string }
        Returns: {
          aprovado_em: string | null
          atualizado_em: string
          bairro: string | null
          contacto_emergencia: string
          criado_em: string
          disponibilidade: boolean
          email: string | null
          estado: string
          foto_perfil_url: string | null
          id: string
          indicativo_telefone: string | null
          motivo_rejeicao: string | null
          motivo_suspensao: string | null
          municipio: string
          nome_completo: string
          provincia: string
          telefone: string
          telefone_nacional: string | null
          termos_aceites_em: string
          user_id: string
          zona_base: string | null
        }
        SetofOptions: {
          from: "*"
          to: "parceiros_entrega"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      territorio_angola_valido: {
        Args: { p_municipio: string; p_provincia: string }
        Returns: boolean
      }
      transicionar_encomenda_levantamento: {
        Args: {
          p_encomenda_id: string
          p_motivo?: string
          p_proximo_estado: string
        }
        Returns: {
          atualizado_em: string
          bairro: string | null
          cancelado_em: string | null
          cliente_id: string
          codigo_publico: string
          concluido_em: string | null
          confirmado_em: string | null
          criado_em: string
          desconto_centimos: number
          destinatario_nome: string
          destinatario_telefone: string
          endereco_levantamento: string | null
          entrega_centimos: number
          estado: string
          id: string
          modalidade_recebimento: string
          moeda: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          municipio: string | null
          observacoes_cliente: string | null
          ponto_referencia: string | null
          provincia: string | null
          recusado_em: string | null
          subtotal_centimos: number
          total_centimos: number
          vendedor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "encomendas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      utilizador_participa_encomenda_mensagens: {
        Args: {
          p_atribuicao_entrega_id: string
          p_canal: string
          p_encomenda_id: string
          p_para_envio?: boolean
          p_utilizador_id: string
        }
        Returns: boolean
      }
      validar_codigo_entrega_entregador: {
        Args: { p_atribuicao_id: string; p_codigo: string }
        Returns: {
          bloqueado: boolean
          estado_encomenda: string
          motivo: string
          tentativas_restantes: number
          validado: boolean
        }[]
      }
      validar_codigo_levantamento_vendedor: {
        Args: { p_codigo: string; p_encomenda_id: string }
        Returns: {
          bloqueado: boolean
          estado_encomenda: string
          motivo: string
          tentativas_restantes: number
          validado: boolean
        }[]
      }
      validar_compra_produto_alheio: {
        Args: { p_itens: Json }
        Returns: undefined
      }
      validar_itens_checkout_operacionais_fase1: {
        Args: { p_itens: Json }
        Returns: undefined
      }
      veiculo_compativel_com_encomenda: {
        Args: { p_encomenda_id: string; p_veiculo_id: string }
        Returns: boolean
      }
      veiculo_operacional_para_entregas: {
        Args: { p_veiculo_id: string }
        Returns: boolean
      }
      veiculo_pode_receber_entregas: {
        Args: { p_veiculo_id: string }
        Returns: boolean
      }
      vendedor_eh_dono: { Args: { vendedor_uuid: string }; Returns: boolean }
      vendedor_eh_dono_aprovado: {
        Args: { vendedor_uuid: string }
        Returns: boolean
      }
      vendedor_pertence_ao_utilizador_autenticado: {
        Args: { p_vendedor_id: string }
        Returns: boolean
      }
      vendedor_pode_receber_encomendas: {
        Args: { p_vendedor_id: string }
        Returns: boolean
      }
      verificar_disponibilidade_cadastro: {
        Args: { p_email?: string; p_telefone: string }
        Returns: {
          email_existe: boolean
          telefone_existe: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
