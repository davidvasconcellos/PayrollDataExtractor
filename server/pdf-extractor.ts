import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import * as pdfParse from 'pdf-parse';

export type PDFSource = 'ERP' | 'RH';

interface ExtractedPage {
  text: string;
  pageNumber: number;
}

async function extractPagesFromPDF(pdfBuffer: Buffer): Promise<ExtractedPage[]> {
  try {
    const data = await pdfParse(pdfBuffer);
    const rawPages = data.text.split(/\f|\n{3,}/);

    return rawPages.map((text, index) => ({
      text: text.trim(),
      pageNumber: index + 1
    })).filter(page => page.text.length > 0);
  } catch (error) {
    console.error('Erro na extração do PDF:', error);
    throw new Error('Falha ao extrair páginas do PDF');
  }
}

function extractERPDate(text: string): string {
  const datePatterns = [
    /Competência:\s*(\d{2})\/(\d{4})/i,
    /Período:\s*(\d{2})\/(\d{4})/i,
    /Data\s*Referência:\s*(\d{2})\/(\d{4})/i,
    /(\d{2})\/(\d{4})/
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }
  return '';
}

function extractRHDate(text: string): string {
  const monthNames = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };

  const pattern = new RegExp(`(${Object.keys(monthNames).join('|')})[\/\\s]*de[\\s]*?(\\d{4})`, 'i');
  const match = text.match(pattern);

  if (match) {
    const month = monthNames[match[1].toLowerCase()];
    return `${month}/${match[2]}`;
  }
  return '';
}

function extractERPItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');

  // Normaliza o texto removendo espaços extras e caracteres especiais
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  for (const code of codes) {
    // Padrões mais específicos para valores monetários
    const patterns = [
      // Código + descrição + R$ + valor
      new RegExp(`${code}\\s*[-:]?\\s*([^R$]+?)\\s*R\\$\\s*(\\d+[.,]\\d{2})`, 'gi'),
      // Código + descrição + valor sem R$
      new RegExp(`${code}\\s*[-:]?\\s*([^0-9]+?)\\s*(\\d+[.,]\\d{2})(?!\\d)`, 'gi'),
      // Busca mais flexível
      new RegExp(`${code}[^]*?(\\d+[.,]\\d{2})`, 'gi')
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(normalizedText)) !== null) {
        const description = match[1]?.trim() || code;
        const valueStr = match[2] || match[1];
        const value = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));

        if (!isNaN(value)) {
          const existingItem = items.find(item => item.code === code);
          if (existingItem) {
            existingItem.value += value;
          } else {
            items.push({ code, description, value });
          }
          break;
        }
      }
    }
  }

  return items;
}

function extractRHItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  for (const code of codes) {
    const patterns = [
      new RegExp(`${code}\\s*[-:]?\\s*([^\\d]+?)\\s*R?\\$?\\s*(\\d+[.,]\\d{2})`, 'gi'),
      new RegExp(`${code}[^]*?(\\d+[.,]\\d{2})`, 'gi')
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(normalizedText)) !== null) {
        const description = match[1]?.trim() || code;
        const valueStr = match[2] || match[1];
        const value = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));

        if (!isNaN(value)) {
          const existingItem = items.find(item => item.code === code);
          if (existingItem) {
            existingItem.value += value;
          } else {
            items.push({ code, description, value });
          }
          break;
        }
      }
    }
  }

  return items;
}

export function extractDate(text: string, source: PDFSource): string {
  return source === 'ERP' ? extractERPDate(text) : extractRHDate(text);
}

export async function processPDF(
  pdfBuffer: Buffer,
  codes: string[],
  source: PDFSource
): Promise<ProcessedPayslip[]> {
  try {
    console.log(`Iniciando processamento do PDF (${source})...`);
    const pages = await extractPagesFromPDF(pdfBuffer);
    const results: ProcessedPayslip[] = [];

    console.log(`Extraídas ${pages.length} páginas do PDF`);

    for (const page of pages) {
      console.log(`\nProcessando página ${page.pageNumber}`);
      console.log('Conteúdo da página:', page.text.substring(0, 200) + '...');

      const date = extractDate(page.text, source);
      console.log('Data extraída:', date);

      const items = source === 'ERP' 
        ? extractERPItems(page.text, codes)
        : extractRHItems(page.text, codes);

      console.log('Itens encontrados:', items);

      if (items.length > 0) {
        results.push({ date: date || '01/2000', items, source });
      }
    }

    console.log(`\nProcessamento finalizado. Encontrados ${results.length} resultados`);
    return results;
  } catch (error) {
    console.error('Erro no processamento do PDF:', error);
    throw error;
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}