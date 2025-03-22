import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';

export type PDFSource = 'ERP' | 'RH';

/**
 * Extract text from a PDF buffer
 * 
 * Simulação de extração para prototipagem
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // Exemplo de texto para ERP
  const erpSampleText = `
    Empresa: Exemplo S.A.
    Funcionário: João Silva
    Data de Referência: 04/2023
    
    Código Descrição Valor
    1001 Salário Base R$ 3.500,00
    1010 Gratificação R$ 500,00
    2001 INSS R$ 350,00
    2002 IRRF R$ 142,76
    3001 Vale Transporte R$ 220,00
    4001 Plano de Saúde R$ 180,00
  `;
  
  // Exemplo de texto para RH Bahia
  const rhSampleText = `
    GOVERNO DO ESTADO DA BAHIA
    Secretaria de Administração
    
    Contracheque
    Abril/2023
    
    0001 Vencimento Base 30.00 04.2023 3.200,00
    0002 Gratificação 30.00 04.2023 480,00
    0010 INSS 30.00 04.2023 320,00
    0011 IRRF 30.00 04.2023 115,42
    0012 Vale Alimentação 30.00 04.2023 350,00
  `;
  
  // Retorna um dos textos de exemplo
  const randomValue = Math.random();
  return randomValue > 0.5 ? erpSampleText : rhSampleText;
}

/**
 * Extract date from the PDF text based on source type
 */
export function extractDate(text: string, source: PDFSource): string {
  if (source === 'ERP') {
    // Match date in format MM/YYYY
    const dateMatch = text.match(/Data de Referência:[\s\n]*(\d{2}\/\d{4})/);
    return dateMatch ? dateMatch[1] : '';
  } else if (source === 'RH') {
    // Match date in format Month/Year (e.g., Abril/2019)
    const dateMatch = text.match(/(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\/\d{4}/);
    return dateMatch ? dateMatch[0] : '';
  }
  
  return '';
}

/**
 * Extract payroll items from ERP PDF
 */
export function extractERPPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');
  
  // Process each line to find matches for the provided codes
  for (const line of lines) {
    for (const code of codes) {
      const regex = new RegExp(`^\\s*${code}\\s+([A-Za-zÀ-ú\\. ]+)\\s+R\\$\\s+(\\d+[,.]\\d+)`, 'i');
      const match = line.match(regex);
      
      if (match) {
        const description = match[1].trim();
        const valueStr = match[2].replace('.', '').replace(',', '.');
        const value = parseFloat(valueStr);
        
        // Check if we already have this code in the results
        const existingIndex = items.findIndex(item => item.code === code);
        
        if (existingIndex >= 0) {
          // Sum the values for duplicate codes
          items[existingIndex].value += value;
        } else {
          items.push({
            code,
            description,
            value
          });
        }
      }
    }
  }
  
  return items;
}

/**
 * Extract payroll items from RH PDF
 */
export function extractRHPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');
  
  // Process each line to find matches for the provided codes
  for (const line of lines) {
    for (const code of codes) {
      // For RH Bahia format, using a different regex pattern
      // Match patterns like: 0002 Vencimento 30.00 04.2019 4.507,61
      const regex = new RegExp(`${code}\\s+([A-Za-zÀ-ú\\. ]+)\\s+\\d+\\.\\d+\\s+\\d+\\.\\d{4}\\s+(\\d+[,.]\\d+)`, 'i');
      const match = line.match(regex);
      
      if (match) {
        const description = match[1].trim();
        const valueStr = match[2].replace('.', '').replace(',', '.');
        const value = parseFloat(valueStr);
        
        // Check if we already have this code in the results
        const existingIndex = items.findIndex(item => item.code === code);
        
        if (existingIndex >= 0) {
          // Sum the values for duplicate codes
          items[existingIndex].value += value;
        } else {
          items.push({
            code,
            description,
            value
          });
        }
      }
    }
  }
  
  return items;
}

/**
 * Process PDF content based on source type
 */
export async function processPDF(pdfBuffer: Buffer, codes: string[], source: PDFSource): Promise<ProcessedPayslip> {
  const text = await extractTextFromPDF(pdfBuffer);
  const date = extractDate(text, source);
  
  let items: ExtractedPayrollItem[] = [];
  
  if (source === 'ERP') {
    items = extractERPPayrollItems(text, codes);
  } else if (source === 'RH') {
    items = extractRHPayrollItems(text, codes);
  }
  
  return {
    date,
    items,
    source
  };
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}
