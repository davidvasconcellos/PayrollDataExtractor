import * as pdfjs from 'pdfjs-dist';
import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';

// Initialize pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

export type PDFSource = 'ERP' | 'RH';

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  
  let text = '';
  
  // Extract text from each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    text += strings.join(' ') + '\n';
  }
  
  return text;
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
