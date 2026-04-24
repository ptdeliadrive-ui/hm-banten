const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

function terbilangHelper(n: number): string {
  if (n < 12) return satuan[n];
  if (n < 20) return satuan[n - 10] + ' Belas';
  if (n < 100) return satuan[Math.floor(n / 10)] + ' Puluh' + (n % 10 ? ' ' + satuan[n % 10] : '');
  if (n < 200) return 'Seratus' + (n % 100 ? ' ' + terbilangHelper(n % 100) : '');
  if (n < 1000) return satuan[Math.floor(n / 100)] + ' Ratus' + (n % 100 ? ' ' + terbilangHelper(n % 100) : '');
  if (n < 2000) return 'Seribu' + (n % 1000 ? ' ' + terbilangHelper(n % 1000) : '');
  if (n < 1000000) return terbilangHelper(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 ? ' ' + terbilangHelper(n % 1000) : '');
  if (n < 1000000000) return terbilangHelper(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 ? ' ' + terbilangHelper(n % 1000000) : '');
  if (n < 1000000000000) return terbilangHelper(Math.floor(n / 1000000000)) + ' Miliar' + (n % 1000000000 ? ' ' + terbilangHelper(n % 1000000000) : '');
  return terbilangHelper(Math.floor(n / 1000000000000)) + ' Triliun' + (n % 1000000000000 ? ' ' + terbilangHelper(n % 1000000000000) : '');
}

export function terbilang(n: number): string {
  if (n === 0) return 'Nol Rupiah';
  return terbilangHelper(Math.floor(n)) + ' Rupiah';
}
