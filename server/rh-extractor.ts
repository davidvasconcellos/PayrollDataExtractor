
import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import 'pdfjs-dist/legacy/build/pdf.worker.entry';

// Interface que define a estrutura de uma página do PDF
interface PDFPage {
  text: string;
  pageNumber: number;
}

// Função que extrai o texto de um arquivo PDF
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFPage[]> {
  console.log("Iniciando extração do PDF RH...");

  try {
    // Carrega o documento PDF usando a biblioteca pdf.js
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    const pages: PDFPage[] = [];

    // Itera sobre cada página do PDF
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Converte o conteúdo da página em texto plano
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({
        text,
        pageNumber: i
      });

      console.log(`Página ${i} extraída com ${text.length} caracteres`);
    }

    return pages;
  } catch (error) {
    console.error("Erro ao extrair texto do PDF RH:", error);
    throw error;
  }
}

// Função que extrai a data de um texto
export function extractDate(text: string): string | null {
  // Mapeamento dos nomes dos meses para números
  const monthMap: { [key: string]: string } = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  // Cria padrão de busca para os meses
  const monthPattern = Object.keys(monthMap).join('|');
  const patterns = [
    // Padrões para encontrar datas no texto
    new RegExp(`\\b(${monthPattern})[\/\\s]*(?:de)?[\\s]*(\\d{4})\\b`, 'i'),
    /(\d{2})[\/\s-](\d{4})/i
  ];

  // Tenta encontrar uma data usando os padrões
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (monthMap[match[1].toLowerCase()]) {
        return `${monthMap[match[1].toLowerCase()]}/${match[2]}`;
      }
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

// Função que extrai itens de folha de pagamento do texto
export function extractPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  // Processa cada código fornecido
  for (const code of codes) {
    const matches = [];
    let count = 0;
    
    // Analisa cada linha do texto
    for (const line of lines) {
      // Padrão para encontrar informações do item de folha de pagamento
      const pattern = new RegExp(`(?:.*?\\s)?\\b${code}\\b[\\s.]*([^\\n\\r]+?)\\s+(?:\\d+(?:\\.\\d{2})?\\s+)?(\\d{2}\\.\\d{4})?\\s*R?\\$?\\s*(\\d+(?:[.,]\\d{3})*(?:[.,]\\d{2}))`, 'i');
      const match = line.match(pattern);

      if (match) {
        const description = match[1].trim();
        const month = match[2] || '';
        const valueStr = match[3].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(valueStr);

        console.log(`RH - Extraindo código ${code}: valor original="${match[3]}", convertido="${valueStr}", final=${value}, mês=${month}`);

        if (!isNaN(value) && description) {
          count++;
          const descriptionWithCount = count > 1 ? `${description}(${count})` : description;
          items.push({ code, description: descriptionWithCount, value });
        }
      }
    }
  }

  return items;
}

// Função principal que processa o PDF completo
export async function processPDF(pdfBuffer: Buffer, codes: string[]): Promise<ProcessedPayslip[]> {
  try {
    console.log(`Processando PDF RH`, codes);

    // Extrai texto de todas as páginas
    const pages = await extractTextFromPDF(pdfBuffer);
    const results: ProcessedPayslip[] = [];

    // Processa cada página individualmente
    for (const page of pages) {
      console.log(`Processando página RH ${page.pageNumber}`);

      // Extrai a data da página
      const date = extractDate(page.text);
      if (!date) {
        console.log(`Data não encontrada na página ${page.pageNumber}`);
        continue;
      }
      console.log('Data extraída RH:', date);

      // Extrai os itens de folha de pagamento
      const items = extractPayrollItems(page.text, codes);
      console.log(`Encontrados ${items.length} itens na página RH ${page.pageNumber}`);

      if (items.length > 0) {
        results.push({ date, items, source: 'RH' });
      }
    }

    console.log(`Processamento RH finalizado. Encontrados ${results.length} conjuntos de dados.`);
    return results;
  } catch (error) {
    console.error('Erro ao processar PDF RH:', error);
    throw error;
  }
}
