document.getElementById('mergeButton').addEventListener('click', mergeFiles);

function mergeFiles() {
    const files = document.getElementById('fileInput').files;
    if (files.length === 0) {
        alert('Please select at least one file.');
        return;
    }

    const readers = [];
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        readers.push(new Promise((resolve, reject) => {
            reader.onload = (event) => {
                try {
                    // JSONパース時に問題があればエラーをキャッチする
                    resolve(JSON.parse(event.target.result));
                } catch (error) {
                    // パースが失敗した場合、ファイルの内容が一行に整形されている場合があるため再処理
                    try {
                        const formattedJSON = formatSingleLineJSON(event.target.result);
                        resolve(JSON.parse(formattedJSON));
                    } catch (secondError) {
                        reject(secondError);
                    }
                }
            };
            reader.onerror = (event) => reject(event);
            reader.readAsText(files[i]);
        }));
    }

    Promise.all(readers).then((results) => {
        const merged = mergeUSCFiles(results);
        const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = 'merged.usc';
        downloadLink.style.display = 'block';
    }).catch((error) => {
        console.error('Error reading files:', error);
    });
}

// 一行に整形されているJSONを改行付きのフォーマットに変換する関数
function formatSingleLineJSON(jsonString) {
    return jsonString
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // キーにクォートを追加
        .replace(/,\s*}/g, '}')                   // 不要なカンマの削除
        .replace(/,\s*]/g, ']');                  // 不要なカンマの削除
}

function mergeUSCFiles(files) {
    const merged = {
        usc: {
            objects: [],
            offset: files[0].usc.offset || 0
        },
        version: 2
    };

    let baseTimeScaleGroupMapping = {};
    let currentBaseTimeScaleGroupCounter = 0;
    let baseFile = files[0];

    // 最初のファイルを基準に設定
    baseFile.usc.objects.forEach((obj) => {
        if (obj.type === 'timeScaleGroup') {
            baseTimeScaleGroupMapping[obj.beat] = currentBaseTimeScaleGroupCounter;
            merged.usc.objects.push(obj);
            currentBaseTimeScaleGroupCounter++;
        } else {
            merged.usc.objects.push(obj);
        }
    });

    // 基準ファイル以外のファイルをマージ
    files.slice(1).forEach((file) => {
        const timeScaleGroupOffset = currentBaseTimeScaleGroupCounter;

        file.usc.objects.forEach((obj) => {
            if (obj.type === 'timeScaleGroup') {
                if (!baseTimeScaleGroupMapping.hasOwnProperty(obj.beat)) {
                    // 新しいtimeScaleGroupを追加
                    baseTimeScaleGroupMapping[obj.beat] = currentBaseTimeScaleGroupCounter;
                    obj.timeScaleGroup = currentBaseTimeScaleGroupCounter;
                    merged.usc.objects.push(obj);
                    currentBaseTimeScaleGroupCounter++;
                } else {
                    // 既存のtimeScaleGroupを再利用
                    obj.timeScaleGroup = baseTimeScaleGroupMapping[obj.beat];
                    merged.usc.objects.push(obj);
                }
            } else {
                if (obj.timeScaleGroup !== undefined) {
                    // timeScaleGroupの再マッピング
                    obj.timeScaleGroup = baseTimeScaleGroupMapping[obj.timeScaleGroup] !== undefined 
                        ? baseTimeScaleGroupMapping[obj.timeScaleGroup] 
                        : obj.timeScaleGroup + timeScaleGroupOffset;
                }
                merged.usc.objects.push(obj);
            }
        });
    });

    // beatでソート
    merged.usc.objects.sort((a, b) => a.beat - b.beat);

    return merged;
}
