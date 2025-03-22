import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';

export type PDFSource = 'ERP' | 'RH';

interface PDFPage {
  text: string;
  pageNumber: number;
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFPage[]> {
  console.log("Iniciando extração de texto do PDF...");

  try {
    // Converter buffer para texto com encoding Latin1 para preservar caracteres especiais
    const text = pdfBuffer.toString('latin1')
      .replace(/[^\x20-\xFF\n\r\t]/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    console.log("Texto extraído do PDF:", text.substring(0, 200) + "...");

    // Dividir em páginas usando marcadores comuns
    const pageMarkers = [
      /Página\s+\d+\s+de\s+\d+/gi,
      /Page\s+\d+\s+of\s+\d+/gi,
      /\f/g,
      /\n{3,}/g
    ];

    let pages: PDFPage[] = [];
    let currentPos = 0;
    let pageNumber = 1;

    // Encontrar divisões de página
    const splits = new Set<number>();
    pageMarkers.forEach(marker => {
      let match;
      const regex = new RegExp(marker);
      while ((match = regex.exec(text)) !== null) {
        splits.add(match.index);
      }
    });

    // Ordenar pontos de divisão
    const sortedSplits = Array.from(splits).sort((a, b) => a - b);

    if (sortedSplits.length > 0) {
      // Criar páginas baseadas nos marcadores encontrados
      sortedSplits.forEach(split => {
        if (split - currentPos > 100) { // Mínimo de 100 caracteres por página
          pages.push({
            text: text.substring(currentPos, split).trim(),
            pageNumber: pageNumber++
          });
          currentPos = split;
        }
      });

      // Adicionar última página
      if (currentPos < text.length) {
        pages.push({
          text: text.substring(currentPos).trim(),
          pageNumber: pageNumber
        });
      }
    } else {
      // Se não encontrou marcadores, usar todo o texto como uma página
      pages.push({
        text: text,
        pageNumber: 1
      });
    }

    console.log(`PDF processado em ${pages.length} páginas`);
    return pages;

  } catch (error) {
    console.error("Erro ao processar PDF:", error);
    throw error;
  }
}

export function extractDate(text: string, source: PDFSource): string {
  console.log(`Extraindo data do texto (${source})`);

  const cleanText = text.replace(/\s+/g, ' ').trim();
  console.log("Texto limpo para extração de data:", cleanText.substring(0, 200));

  if (source === 'ERP') {
    const patterns = [
      /Data\s*de\s*Refer[êe]ncia:?\s*(\d{2}\/\d{4})/i,
      /Compet[êe]ncia:?\s*(\d{2}\/\d{4})/i,
      /Per[íi]odo:?\s*(\d{2}\/\d{4})/i,
      /(\d{2})\/(\d{4})/,
      /\b(\d{2}\/\d{4})\b/
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const date = match[1].includes('/') ? match[1] : `${match[1]}/${match[2]}`;
        console.log("Data encontrada (ERP):", date);
        return date;
      }
    }
  } else {
    const monthNames = '(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)';
    const patterns = [
      new RegExp(`${monthNames}\\s*/?\\s*(20\\d{2})`, 'i'),
      new RegExp(`${monthNames}\\s*/?\\s*(\\d{4})`, 'i'),
      new RegExp(`Data\\s*de\\s*Refer[êe]ncia:?\\s*${monthNames}\\s*/?\\s*(\\d{4})`, 'i')
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        if (match[1].match(/^\d{2}$/)) {
          console.log("Data encontrada (RH - numérica):", match[0]);
          return match[0];
        } else {
          const month = match[1];
          const year = match[2] || match[3];
          console.log("Data encontrada (RH - texto):", `${month}/${year}`);
          return `${month}/${year}`;
        }
      }
    }
  }

  console.log("Data não encontrada, usando data atual");
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export function extractERPPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  console.log("Extraindo itens ERP com códigos:", codes);
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');

  // Padrões comuns em contracheques ERP
  const patterns = [
    /(\d{4})[.\s]+([^R$]+)R\$\s*([\d.,]+)/i,
    /(\d{4})\s+([^0-9]+?)\s+([\d.,]+)/i,
    /(\d{4})[.\s]+([^\d]+)[\s.]*?([\d.,]+)/i
  ];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    console.log("Processando linha:", cleanLine);

    let matched = false;
    for (const pattern of patterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        const code = match[1];
        const description = match[2].trim();
        const valueStr = match[3].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(valueStr);

        if (!isNaN(value) && codes.includes(code)) {
          console.log(`Item encontrado - Código: ${code}, Valor: ${value}`);

          const existingIndex = items.findIndex(item => item.code === code);
          if (existingIndex >= 0) {
            items[existingIndex].value += value;
          } else {
            items.push({ code, description, value });
          }
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      console.log("Linha não corresponde aos padrões");
    }
  }

  console.log("Itens extraídos:", items);
  return items;
}

export function extractRHPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  console.log("Extraindo itens RH com códigos:", codes);
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');

  // Padrões para RH
  const patterns = [
    /(\d{4})[.\s]+([^R$]+)R\$\s*([\d.,]+)/i,
    /(\d{4})\s+([^0-9]+?)\s+([\d.,]+)/i,
    /(\d{3,4})[.\s]+([^\d]+)[\s.]*?([\d.,]+)/i
  ];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    console.log("Processando linha:", cleanLine);

    let matched = false;
    for (const pattern of patterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        const code = match[1].padStart(4, '0');
        const description = match[2].trim();
        const valueStr = match[3].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(valueStr);

        if (!isNaN(value) && codes.includes(code)) {
          console.log(`Item encontrado - Código: ${code}, Valor: ${value}`);

          const existingIndex = items.findIndex(item => item.code === code);
          if (existingIndex >= 0) {
            items[existingIndex].value += value;
          } else {
            items.push({ code, description, value });
          }
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      console.log("Linha não corresponde aos padrões");
    }
  }

  console.log("Itens extraídos:", items);
  return items;
}

export async function processPDF(pdfBuffer: Buffer, codes: string[], source: PDFSource): Promise<ProcessedPayslip[]> {
  console.log(`Iniciando processamento do PDF (${source})`);
  console.log("Códigos a serem extraídos:", codes);

  try {
    const pages = await extractTextFromPDF(pdfBuffer);
    const results: ProcessedPayslip[] = [];

    for (const page of pages) {
      console.log(`Processando página ${page.pageNumber}`);

      const date = extractDate(page.text, source);
      let items: ExtractedPayrollItem[] = [];

      if (source === 'ERP') {
        items = extractERPPayrollItems(page.text, codes);
      } else {
        items = extractRHPayrollItems(page.text, codes);
      }

      if (items.length > 0) {
        console.log(`Página ${page.pageNumber} - Itens encontrados:`, items);
        results.push({ date, items, source });
      } else {
        console.log(`Página ${page.pageNumber} - Nenhum item encontrado`);
      }
    }

    if (results.length === 0) {
      console.log("Nenhum resultado encontrado no PDF");
      const now = new Date();
      results.push({
        date: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
        items: [],
        source
      });
    }

    return results;
  } catch (error) {
    console.error("Erro ao processar PDF:", error);
    throw error;
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}