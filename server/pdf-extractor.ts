import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import * as fs from 'fs';

export type PDFSource = 'ERP' | 'RH';

/**
 * Extract text from a PDF buffer
 * 
 * Simulação de extração para prototipagem
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // Para prototipagem, vamos usar o conteúdo de teste específico para aplicação
  const testText = `
                                      ORGÃO TESTE DO ESTADO DO TESTE
                                      Sistema de Dados do Do Teste
                                      Relatório de Folha de Pagamento


Matrícula: 999999999                  Nome do Servidor: FULANO MARCOS   CPF: 999.999.999-   Orgão:
                                      Cargo: TESTE                      99                  TADR
Data de Referência:
11/2023                                                                 Data de Admissão:   Tipo de Folha:
                                                                        17/07/2002          Normal
                                      Situação Funcional: FERIAS        Data da Situação:
                                                                        03/11/2023
   Código                Vantagem                  Valor
0658            AUX.ALIMEN                      R$ 180,00
0650            CRED.HABIT                      R$ 781,09
0160            GCG                             R$ 5.536,69
0146            AD.T.SERV                       R$ 228,29
0002            VENCIMENTO                      R$ 2.853,67
                Total de Vantagens:             R$ 9.579,74
   Código              Desconto                    Valor
0821            COMPL.DEP                       R$ 255,20
0815            IMP.RENDA                       R$ 1.227,17
0808            PREVIDENCI                      R$ 1.034,23
0803            ASS.SAUDE                       R$ 290,00
0738            EMPREST BB                      R$ 439,28
0683            ASS.ODONT                       R$ 17,28
0590            MENSAL-VAL                      R$ 28,53
0562            PRESTACAO                       R$ 1.494,61
                Total de Descontos:            R$ 4.786,30
Total Geral:                                   R$ 4.793,44
`;

  console.log("Simulando extração de PDF...");
  return testText;
}

/**
 * Extract date from the PDF text based on source type
 */
export function extractDate(text: string, source: PDFSource): string {
  console.log('Extraindo data do texto do PDF, fonte:', source);
  
  if (source === 'ERP') {
    // Tenta encontrar formato MM/YYYY para ERP após "Data de Referência:"
    const dateMatchERP = text.match(/Data de Referência:[\s\n]*(\d{2}\/\d{4})/i);
    
    if (dateMatchERP) {
      console.log('Data ERP encontrada:', dateMatchERP[1]);
      return dateMatchERP[1];
    }
    
    // Alternativa para quando a data está na linha seguinte
    const altDateMatchERP = text.match(/Data de Referência:\s*\n(\d{2}\/\d{4})/i);
    if (altDateMatchERP) {
      console.log('Data ERP alternativa encontrada:', altDateMatchERP[1]);
      return altDateMatchERP[1];
    }
  } 
  else if (source === 'RH') {
    // Para RH Bahia - procura por padrão Mês/Ano (ex: Abril/2022)
    const monthNames = '(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)';
    const dateMatchRH = text.match(new RegExp(monthNames + '\\/\\d{4}', 'i'));
    
    if (dateMatchRH) {
      console.log('Data RH encontrada (mês):', dateMatchRH[0]);
      return dateMatchRH[0];
    }
    
    // Alternativa - verificar também formato numérico em RH
    const altDateMatchRH = text.match(/(\d{2})\/(\d{4})/);
    if (altDateMatchRH) {
      console.log('Data RH alternativa encontrada (numérica):', altDateMatchRH[0]);
      return altDateMatchRH[0];
    }
  }
  
  // Busca genérica para qualquer formato de data quando nenhum dos padrões anteriores funcionou
  const genericDateMatch = text.match(/(\d{2})\/(\d{4})/);
  if (genericDateMatch) {
    console.log('Data genérica encontrada:', genericDateMatch[0]);
    return genericDateMatch[0];
  }
  
  console.log('Nenhuma data encontrada, usando data atual');
  
  // Se nenhum formato for encontrado, usa a data atual
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${month}/${year}`;
}

/**
 * Extract payroll items from ERP PDF
 */
export function extractERPPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');
  
  console.log("Códigos a serem extraídos:", codes);
  
  // Process each line to find matches for the provided codes
  for (const line of lines) {
    // Para o formato do PDF de teste
    const lineMatch = line.match(/^(\d{4})\s+([A-Za-zÀ-ú\.\s]+)\s+R\$\s+([\d\.,]+)/);
    
    if (lineMatch) {
      const code = lineMatch[1];
      const description = lineMatch[2].trim();
      const valueStr = lineMatch[3].replace('.', '').replace(',', '.');
      const value = parseFloat(valueStr);
      
      console.log(`Encontrado no PDF: Código ${code}, Descrição: ${description}, Valor: ${value}`);
      
      // Verifica se este código está na lista de códigos solicitados
      if (codes.includes(code)) {
        console.log(`Código ${code} está na lista de códigos a extrair`);
        
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
  
  console.log("Itens extraídos:", items);
  return items;
}

/**
 * Extract payroll items from RH PDF
 */
export function extractRHPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');
  
  console.log("RH - Códigos a serem extraídos:", codes);
  
  // Process each line to find matches for the provided codes
  for (const line of lines) {
    // Para o formato do PDF de teste
    const lineMatch = line.match(/^(\d{4})\s+([A-Za-zÀ-ú\.\s]+)\s+R\$\s+([\d\.,]+)/);
    
    if (lineMatch) {
      const code = lineMatch[1];
      const description = lineMatch[2].trim();
      const valueStr = lineMatch[3].replace('.', '').replace(',', '.');
      const value = parseFloat(valueStr);
      
      console.log(`RH - Encontrado no PDF: Código ${code}, Descrição: ${description}, Valor: ${value}`);
      
      // Verifica se este código está na lista de códigos solicitados
      if (codes.includes(code)) {
        console.log(`RH - Código ${code} está na lista de códigos a extrair`);
        
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
  
  console.log("RH - Itens extraídos:", items);
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
