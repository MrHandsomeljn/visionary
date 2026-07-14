param(
    [string]$ImagePath = "C:\Users\weilab\Desktop\test.png",
    [string]$BaseUrl = "http://127.0.0.1:25367",
    [string]$Model = "TRELLIS.2-512",
    [string]$OutDir = "C:\Users\weilab\Desktop\trellis_result"
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "Reading image: $ImagePath"
$imageBytes = [System.IO.File]::ReadAllBytes($ImagePath)
$imageBase64 = [Convert]::ToBase64String($imageBytes)

$submitHeaders = @{
    "X-TC-Action" = "SubmitHunyuanTo3DProJob"
}

$submitBody = @{
    Model = $Model
    ImageBase64 = $imageBase64
} | ConvertTo-Json -Depth 10

Write-Host "Submitting job..."
$submitResp = Invoke-RestMethod `
    -Uri "$BaseUrl/" `
    -Method Post `
    -Headers $submitHeaders `
    -ContentType "application/json" `
    -Body $submitBody

$jobId = $submitResp.Response.JobId

if (-not $jobId) {
    Write-Host "Submit failed:"
    $submitResp | ConvertTo-Json -Depth 20
    exit 1
}

Write-Host "JobId: $jobId"

$queryHeaders = @{
    "X-TC-Action" = "QueryHunyuanTo3DProJob"
}

$queryBody = @{
    JobId = $jobId
} | ConvertTo-Json -Depth 10

while ($true) {
    Start-Sleep -Seconds 5

    $queryResp = Invoke-RestMethod `
        -Uri "$BaseUrl/" `
        -Method Post `
        -Headers $queryHeaders `
        -ContentType "application/json" `
        -Body $queryBody

    $r = $queryResp.Response

    Write-Host ("Status={0}, Stage={1}, TotalProgress={2}%, Stage={3}/{4}, StageProgress={5}%, Estimated={6}, Message={7}" -f `
        $r.Status,
        $r.Stage,
        $r.Progress,
        $r.StageIndex,
        $r.StageCount,
        $r.StageProgress,
        $r.StageProgressEstimated,
        $r.StageMessage)


    if ($r.Status -eq "DONE") {
        Write-Host "Job done."

        if ($r.ResultFile3Ds -and $r.ResultFile3Ds.Count -gt 0) {
            $glbUrl = $r.ResultFile3Ds[0].Url
            $glbPath = Join-Path $OutDir "$jobId.glb"

            Write-Host "Downloading GLB: $glbUrl"
            Invoke-WebRequest -Uri $glbUrl -OutFile $glbPath
            Write-Host "Saved GLB: $glbPath"
        }

        if ($r.ResultImages -and $r.ResultImages.Count -gt 0) {
            $cutoutUrl = $r.ResultImages[0].Url
            $cutoutPath = Join-Path $OutDir "$jobId.cutout.png"

            Write-Host "Downloading cutout image: $cutoutUrl"
            Invoke-WebRequest -Uri $cutoutUrl -OutFile $cutoutPath
            Write-Host "Saved cutout: $cutoutPath"
        }

        break
    }

    if ($r.Status -eq "FAIL") {
        Write-Host "Job failed:"
        $queryResp | ConvertTo-Json -Depth 20
        exit 1
    }
}