/**
 * Multi-format detector — identifies the real container format from leading
 * bytes (never from the file extension; field teams rename things constantly).
 *
 * Handles the formats that actually show up in a provider-network inbox:
 * PDF, OOXML (DOCX/XLSX), RTF, HEIC phone photos of faxed/scanned forms,
 * legacy Outlook TNEF (winmail.dat), and plain RFC-822 email bodies.
 */

export interface DetectedFormat {
  format: string;
  decoder: string;
}

const TNEF_SIGNATURE = '789f3e22'; // little-endian 0x223E9F78

export function detectFormat(bytesHex: string, fileName: string): DetectedFormat {
  const hex = bytesHex.toLowerCase();

  if (hex.startsWith('25504446')) {
    return { format: 'PDF', decoder: 'pdf-layout' };
  }
  if (hex.startsWith('504b0304')) {
    // OOXML = zip container; disambiguate by declared part name.
    const fmt = /\.xlsx$/i.test(fileName) ? 'XLSX (OOXML)' : 'DOCX (OOXML)';
    return { format: fmt, decoder: 'ooxml-sheet' };
  }
  if (hex.startsWith(TNEF_SIGNATURE)) {
    return { format: 'TNEF (legacy Outlook)', decoder: 'tnef-unwrap' };
  }
  if (hex.startsWith('7b5c727466')) {
    // ASCII '{\rtf' — RTF header
    return { format: 'RTF', decoder: 'rtf-strip' };
  }
  if (hex.includes('667479706865696')) {
    // 'ftypheic'-family brand inside the ISO-BMFF box (heic/heif/heim/heis)
    return { format: 'HEIC', decoder: 'heif-convert' };
  }
  if (hex.startsWith('52656365697665643a') || hex.startsWith('46726f6d3a')) {
    // ASCII "Received:" / "From:" — bare RFC-822 message
    return { format: 'EML', decoder: 'rfc822-parse' };
  }
  return { format: 'UNKNOWN', decoder: 'binary-fallback' };
}
