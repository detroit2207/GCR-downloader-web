import React, { useState, useEffect, useMemo } from 'react';

const FileSelector = ({ files, onConfirm, onCancel }) => {
    const [selectedIds, setSelectedIds] = useState(new Set(files.map(f => f.id)));

    // Group files by type
    const groupedFiles = useMemo(() => {
        const groups = {};
        files.forEach(f => {
            let type = "Others";
            if (f.mimeType && f.mimeType.includes("video")) type = "Videos";
            else if (f.mimeType && f.mimeType.includes("pdf")) type = "PDFs";
            else if (f.mimeType && (f.mimeType.includes("word") || f.mimeType.includes("document"))) type = "Documents";
            else if (f.mimeType && (f.mimeType.includes("presentation") || f.mimeType.includes("powerpoint"))) type = "Presentations";
            else if (f.name.endsWith('.pptx') || f.name.endsWith('.ppt')) type = "Presentations";
            else if (f.mimeType && f.mimeType.includes("image")) type = "Images";

            if (!groups[type]) groups[type] = [];
            groups[type].push(f);
        });
        return groups;
    }, [files]);

    const toggleFile = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleGroup = (type) => {
        const groupFiles = groupedFiles[type];
        const allSelected = groupFiles.every(f => selectedIds.has(f.id));
        const newSelected = new Set(selectedIds);

        groupFiles.forEach(f => {
            if (allSelected) newSelected.delete(f.id);
            else newSelected.add(f.id);
        });
        setSelectedIds(newSelected);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)', border: '4px solid #9ECE6A' }}>
                <h2 style={{ marginTop: 0, color: '#9ECE6A' }}>Select Files to Download</h2>

                {Object.entries(groupedFiles).map(([type, groupFiles]) => {
                    const allSelected = groupFiles.every(f => selectedIds.has(f.id));
                    const indeterminate = !allSelected && groupFiles.some(f => selectedIds.has(f.id));

                    return (
                        <div key={type} style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'transparent', padding: '8px', borderRadius: '4px' }}>
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={input => { if (input) input.indeterminate = indeterminate; }}
                                    onChange={() => toggleGroup(type)}
                                    style={{ marginRight: '10px', accentColor: '#9ECE6A' }}
                                />
                                <h4 style={{ margin: 0, color: '#9ECE6A', fontSize: '0.8rem' }}>{type} ({groupFiles.length})</h4>
                            </div>
                            <div style={{ paddingLeft: '20px', marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                {groupFiles.map(f => (
                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', fontSize: '0.6rem', color: '#9ECE6A' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(f.id)}
                                            onChange={() => toggleFile(f.id)}
                                            style={{ marginRight: '8px', accentColor: '#9ECE6A' }}
                                        />
                                        <span title={f.path} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {f.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', sticky: 'bottom' }}>
                    <button onClick={onCancel} style={{ color: '#9ECE6A', padding: '8px 16px', background: 'transparent', border: '1px solid #9ECE6A', borderRadius: '4px', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(Array.from(selectedIds))}
                        style={{ padding: '8px 16px', background: 'transparent', color: '#9ECE6A', border: '1px solid #9ECE6A', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Download Selected ({selectedIds.size})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FileSelector;
