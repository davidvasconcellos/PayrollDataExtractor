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
    { code: '001', description: 'Salário Base', category: 'PROVENTOS' },
    { code: '002', description: 'Adicional por Tempo de Serviço', category: 'PROVENTOS' },
    { code: '003', description: 'Gratificação de Função', category: 'PROVENTOS' },
    { code: '004', description: 'Hora Extra 50%', category: 'PROVENTOS' },
    { code: '005', description: 'Hora Extra 100%', category: 'PROVENTOS' },
    { code: '006', description: 'Adicional Noturno', category: 'PROVENTOS' },
    { code: '007', description: 'Adicional de Insalubridade', category: 'PROVENTOS' },
    { code: '008', description: 'Adicional de Periculosidade', category: 'PROVENTOS' },
    { code: '009', description: '13º Salário', category: 'PROVENTOS' },
    { code: '010', description: 'Férias', category: 'PROVENTOS' },
  
    // Descontos
    { code: '501', description: 'INSS', category: 'DESCONTOS' },
    { code: '502', description: 'IRRF', category: 'DESCONTOS' },
    { code: '503', description: 'Vale Transporte', category: 'DESCONTOS' },
    { code: '504', description: 'Vale Alimentação', category: 'DESCONTOS' },
    { code: '505', description: 'Plano de Saúde', category: 'DESCONTOS' },
    { code: '506', description: 'Contribuição Sindical', category: 'DESCONTOS' },
    { code: '507', description: 'Faltas', category: 'DESCONTOS' },
    { code: '508', description: 'Adiantamento Salarial', category: 'DESCONTOS' },
  
    // Outros
    { code: '901', description: 'Base INSS', category: 'OUTROS' },
    { code: '902', description: 'Base FGTS', category: 'OUTROS' },
    { code: '903', description: 'Base IRRF', category: 'OUTROS' },
  ];
  
  // Modelos (cargos) pré-definidos
  export const predefinedModels: PayrollModel[] = [
    {
      name: 'Analista Administrativo',
      description: 'Cargo de analista com foco em atividades administrativas',
      codes: ['001', '002', '501', '502', '503', '504']
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