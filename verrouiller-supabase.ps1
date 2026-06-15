# Script de verrouillage Supabase JS v2.108.1
# À lancer depuis C:\restauration-bouleaux

$ancien = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"'
$nouveau = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.1"'

$fichiers = Get-ChildItem -Path . -Filter *.html -File

$total = 0
$modifies = 0

foreach ($f in $fichiers) {
    $contenu = Get-Content $f.FullName -Raw
    if ($contenu -match [regex]::Escape($ancien)) {
        $nouveauContenu = $contenu -replace [regex]::Escape($ancien), $nouveau
        Set-Content -Path $f.FullName -Value $nouveauContenu -NoNewline
        Write-Host "OK : $($f.Name)" -ForegroundColor Green
        $modifies++
    }
    $total++
}

Write-Host ""
Write-Host "Termine : $modifies fichier(s) modifie(s) sur $total HTML analyses." -ForegroundColor Cyan