// script.js

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
            reader.onload = (event) => resolve(JSON.parse(event.target.result));
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

function mergeUSCFiles(files) {
    const merged = {
        usc: {
            objects: [],
            offset: files[0].usc.offset || 0
        },
        version: 2
    };

    let timeScaleGroupCounter = 0;
    const timeScaleGroupMapping = {};

    files.forEach((file) => {
        const currentTimeScaleGroupMapping = {};

        file.usc.objects.forEach((obj) => {
            if (obj.type === 'timeScaleGroup') {
                currentTimeScaleGroupMapping[timeScaleGroupCounter] = obj;
                merged.usc.objects.push(obj);
                timeScaleGroupMapping[obj.timeScaleGroup] = timeScaleGroupCounter;
                timeScaleGroupCounter++;
            } else if (obj.timeScaleGroup !== undefined) {
                obj.timeScaleGroup = timeScaleGroupMapping[obj.timeScaleGroup] || obj.timeScaleGroup;
                merged.usc.objects.push(obj);
            } else {
                merged.usc.objects.push(obj);
            }
        });
    });

   
    merged.usc.objects.sort((a, b) => a.beat - b.beat);

    return merged;
}

