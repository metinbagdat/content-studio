Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(
  "learnconnect.net yenileme zamani!`n`nname.com hesabinizi acin.`nDomain bitis: 21 Kasim 2026`n`nRenew veya hesap erisimini duzeltin.",
  'Domain Hatirlatma - learnconnect.net',
  'OK',
  'Information'
) | Out-Null
