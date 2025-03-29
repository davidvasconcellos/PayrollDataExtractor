// Definições de verbas e modelos pré-definidos para folha de pagamento

// Interface para definição de verba
export interface PayrollCode {
    code: string;
    description: string;
    category: 'PROVENTOS' | 'DESCONTOS' | 'OUTROS';
  }
  
  // Interface para definição de modelo (cargo)
  export interface PayrollModel {
    name: string;
    description: string;
    codes: string[]; // Códigos das verbas associadas ao cargo
  }
  
  // Verbas pré-definidas
  export const predefinedCodes: PayrollCode[] = [
    // Proventos
    { code: '0002, 00002', description: 'VENCIMENTO', category: 'PROVENTOS' },
    { code: '0146, 00146, 2033', description: 'Adicional por Tempo de Serviço', category: 'PROVENTOS' },
    { code: '0160, 00160, 0037', description: '(GCG) Grat Exec Ativ Ciclo Gest', category: 'PROVENTOS' },
    { code: '0153, 00153, 1116, 00423, 0423, 1084, 1143', description: 'CET', category: 'PROVENTOS' },
    { code: '0527, 00527, MZ02, 331', description: '1/3 FERIAS', category: 'PROVENTOS' },
    { code: '0544, 00544', description: '13 SALARIO', category: 'PROVENTOS' },
    { code: '00537, 0537, 0400, 332,', description: 'ADIANT 13 SALARIO', category: 'PROVENTOS' },
    { code: '0703, 00703, 1101', description: 'INSTRUTORIA', category: 'PROVENTOS' },
    { code: '2023, 2079', description: 'Estabilidade Economica', category: 'PROVENTOS' },
    { code: '0823, 00823', description: 'Vantagem Pessoal', category: 'PROVENTOS' },
    { code: '0026, 00026', description: 'D.A.I', category: 'PROVENTOS' },
    { code: '0025, 00025, 0008', description: 'D.A.S', category: 'PROVENTOS' },
    { code: '0775, 00775', description: 'DIF SALARIO', category: 'PROVENTOS' },
    { code: '3345', description: 'DIF FERIAS', category: 'PROVENTOS' },
    { code: '337', description: 'DIF 13 SAL', category: 'PROVENTOS' },
    { code: '0658, 00658, 7029', description: 'AUX ALIMENT', category: 'PROVENTOS' },
    { code: '0657, 00657', description: 'AUX TRANSPORTE', category: 'PROVENTOS' },
    { code: '0546, 00546, ', description: '13 SAL VAR', category: 'PROVENTOS' },

  
    // Descontos
    { code: '0808, 00808, 7P40', description: 'PREVIDENCIA', category: 'DESCONTOS' },
    { code: '0815, 00815, 401', description: 'IRRF', category: 'DESCONTOS' },
    { code: '0816, 00816, ', description: 'IR FERIAS', category: 'DESCONTOS' },
    { code: '0817, 00817, 403', description: 'IR 13 SAL', category: 'DESCONTOS' },
    { code: '0806, 00806, 7P42', description: 'PREV 13 SAL', category: 'DESCONTOS' },
    { code: '0550, 00550', description: 'AD 13 SAL(DEZ)', category: 'DESCONTOS' },
    { code: '730R', description: 'TRIB RPPS RRA', category: 'DESCONTOS' },
    { code: '730F', description: 'TRIB FUNPREV RRA', category: 'DESCONTOS' },
  
    // Outros
    { code: '7014', description: 'REEMBOLSO N TRIBU.', category: 'OUTROS' },
    { code: '6008', description: 'RESTITUICAO', category: 'OUTROS' },
    { code: '2043', description: 'RRA', category: 'OUTROS' },
    { code: '6006', description: 'IND FAZENDA', category: 'OUTROS' },
    { code: '0D09', description: 'DESC ADTO DIF SAL', category: 'OUTROS' },

  ];
  
  // Modelos (cargos) pré-definidos
  export const predefinedModels: PayrollModel[] = [
    {
      name: 'ESPEC POL PUB GESTAO GOVERNAME',
      description: 'Cargo de Especialista em Políticas Públicas e Gestão Governamental',
      codes: ['0002', '00002', '0160', '00160', '0037', '0146', '00146', '2033', '0153', '00153', '1116', '00423', '0423', '1084', '0527', '00527', 'MZ02', '331', '0544', '00544', '00537', '0537', '0400', '332', '0703', '00703', '1101', '2023', '2079', '0823', '00823', '0026', '00026', '0025', '00025', '0008', '0775', '00775', '0120', '00120', '2017']
    },
    {
      name: 'Operador de Produção',
      description: 'Cargo operacional com adicionais de periculosidade',
      codes: ['001', '006', '008', '501', '502', '503', '504']
    },
    {
      name: 'Supervisor',
      description: 'Cargo de supervisão com gratificação de função',
      codes: ['001', '002', '003', '501', '502', '504', '505']
    },
    {
      name: 'Vendedor',
      description: 'Cargo comercial com comissões',
      codes: ['001', '501', '502', '503', '504']
    }
  ];
  
  // Função para obter verba por código
  export function getCodeByNumber(code: string): PayrollCode | undefined {
    return predefinedCodes.find(c => c.code === code);
  }
  
  // Função para obter modelo por nome
  export function getModelByName(name: string): PayrollModel | undefined {
    return predefinedModels.find(m => m.name === name);
  }
  
  // Função para obter todas as verbas de uma categoria
  export function getCodesByCategory(category: PayrollCode['category']): PayrollCode[] {
    return predefinedCodes.filter(c => c.category === category);
  }
  
  // Função para validar se um código existe
  export function isValidCode(code: string): boolean {
    return predefinedCodes.some(c => c.code === code);
  }
  
  // Função para obter descrição de um código
  export function getCodeDescription(code: string): string {
    const payrollCode = getCodeByNumber(code);
    return payrollCode ? payrollCode.description : code;
  }