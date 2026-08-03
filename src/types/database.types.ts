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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
      clientes: {
        Row: {
          atualizado_em: string | null
          conta_ativa: boolean | null
          criado_em: string | null
          email: string | null
          email_login: string | null
          foto_perfil: string | null
          id: string
          municipio: string | null
          nome: string | null
          provincia: string | null
          telefone: string | null
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
          municipio?: string | null
          nome?: string | null
          provincia?: string | null
          telefone?: string | null
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
          municipio?: string | null
          nome?: string | null
          provincia?: string | null
          telefone?: string | null
          tipo_comprador?: string | null
        }
        Relationships: []
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
      produtos: {
        Row: {
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
          preco_aproximado: number | null
          preco_grosso: number | null
          preco_promocional: number | null
          provincia: string | null
          publicado: boolean | null
          quantidade_minima: number | null
          quantidade_minima_grosso: number | null
          subcategoria: string | null
          tipo_destaque: string | null
          tipo_venda: string | null
          unidade: string | null
          vendedor_id: string | null
          visualizacoes: number | null
        }
        Insert: {
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
          preco_aproximado?: number | null
          preco_grosso?: number | null
          preco_promocional?: number | null
          provincia?: string | null
          publicado?: boolean | null
          quantidade_minima?: number | null
          quantidade_minima_grosso?: number | null
          subcategoria?: string | null
          tipo_destaque?: string | null
          tipo_venda?: string | null
          unidade?: string | null
          vendedor_id?: string | null
          visualizacoes?: number | null
        }
        Update: {
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
          preco_aproximado?: number | null
          preco_grosso?: number | null
          preco_promocional?: number | null
          provincia?: string | null
          publicado?: boolean | null
          quantidade_minima?: number | null
          quantidade_minima_grosso?: number | null
          subcategoria?: string | null
          tipo_destaque?: string | null
          tipo_venda?: string | null
          unidade?: string | null
          vendedor_id?: string | null
          visualizacoes?: number | null
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
      servicos: {
        Row: {
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
          preco_promocional: number | null
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
          preco_promocional?: number | null
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
          preco_promocional?: number | null
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
            foreignKeyName: "servicos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
          documentos: Json | null
          email: string | null
          email_login: string | null
          endereco_detalhado: string | null
          entrega_disponivel: boolean | null
          entrega_outras_provincias: boolean | null
          foto_perfil: string | null
          horario_atendimento: string | null
          id: string
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
          documentos?: Json | null
          email?: string | null
          email_login?: string | null
          endereco_detalhado?: string | null
          entrega_disponivel?: boolean | null
          entrega_outras_provincias?: boolean | null
          foto_perfil?: string | null
          horario_atendimento?: string | null
          id?: string
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
          documentos?: Json | null
          email?: string | null
          email_login?: string | null
          endereco_detalhado?: string | null
          entrega_disponivel?: boolean | null
          entrega_outras_provincias?: boolean | null
          foto_perfil?: string | null
          horario_atendimento?: string | null
          id?: string
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
      apagar_minha_conta: { Args: never; Returns: undefined }
      desativar_minha_conta: { Args: never; Returns: undefined }
      destacar_produto_gratis: {
        Args: { produto_uuid: string }
        Returns: undefined
      }
      destacar_servico_gratis: {
        Args: { servico_uuid: string }
        Returns: undefined
      }
      expirar_destaques_antigos: { Args: never; Returns: undefined }
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
      remover_destaque_produto: {
        Args: { produto_uuid: string }
        Returns: undefined
      }
      remover_destaque_servico: {
        Args: { servico_uuid: string }
        Returns: undefined
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
