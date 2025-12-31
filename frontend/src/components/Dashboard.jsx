import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FileSelector from './FileSelector';
import '../Modal.css';

const Dashboard = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for File Selection
    const [selectingCourse, setSelectingCourse] = useState(null); // { id, name }
    const [filesToSelect, setFilesToSelect] = useState(null); // Array of file objects
    const [loadingMaterials, setLoadingMaterials] = useState(false);

    // State for Download Job
    const [downloadJob, setDownloadJob] = useState(null); // { id, courseName, progress, status, message }

    useEffect(() => {
        fetchCourses();
    }, []);

    useEffect(() => {
        let interval;
        if (downloadJob && downloadJob.status !== 'COMPLETED' && downloadJob.status !== 'FAILED') {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`http://localhost:8000/download/status/${downloadJob.id}`);
                    setDownloadJob(prev => ({ ...prev, ...res.data }));

                    if (res.data.status === 'COMPLETED') {
                        // Trigger file download
                        window.location.href = `http://localhost:8000/download/result/${downloadJob.id}`;
                        clearInterval(interval);
                        setTimeout(() => setDownloadJob(null), 2000); // Close modal 2s after complete
                    } else if (res.data.status === 'FAILED') {
                        clearInterval(interval);
                    }
                } catch (err) {
                    console.error("Polling error", err);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [downloadJob?.id, downloadJob?.status]);

    const fetchCourses = async () => {
        try {
            const response = await axios.get('http://localhost:8000/courses', {
                withCredentials: true
            });
            setCourses(response.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 401) {
                window.location.href = "/";
            } else {
                setError("Failed to fetch courses");
                setLoading(false);
            }
        }
    };

    const onDownloadClick = async (courseId, courseName) => {
        // 1. Fetch materials first
        setLoadingMaterials(true);
        try {
            const res = await axios.get(`http://localhost:8000/courses/${courseId}/materials`, { withCredentials: true });
            setFilesToSelect(res.data);
            setSelectingCourse({ id: courseId, name: courseName });
        } catch (err) {
            console.error("Failed to load materials", err);
            alert("Failed to load course materials");
        } finally {
            setLoadingMaterials(false);
        }
    };

    const handleConfirmSelection = async (selectedIds) => {
        const { id, name } = selectingCourse;
        setSelectingCourse(null);
        setFilesToSelect(null);

        // Start download job
        try {
            setDownloadJob({ id: null, courseName: name, progress: 0, status: 'STARTING', message: 'Initializing...' });
            const res = await axios.post(`http://localhost:8000/courses/${id}/download/start`,
                { courseName: name, selectedFileIds: selectedIds },
                { withCredentials: true }
            );
            setDownloadJob({ id: res.data.job_id, courseName: name, progress: 0, status: 'QUEUED', message: 'Queued...' });
        } catch (err) {
            console.error(err);
            setDownloadJob({ status: 'FAILED', message: 'Failed to start download.' });
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading courses...</div>;
    if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: '#202124' }}>My Courses</h1>
                <button onClick={() => window.location.href = 'http://localhost:8000/auth/logout'} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {courses.map(course => (
                    <div key={course.id} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
                        <div style={{ height: '100px', backgroundColor: '#1a73e8', color: 'white', padding: '16px' }}>
                            <h2 style={{ fontSize: '1.25rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</h2>
                            <p style={{ opacity: 0.9 }}>{course.section}</p>
                        </div>
                        <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {loadingMaterials && selectingCourse?.id === course.id && <span style={{ marginRight: 10, fontSize: '0.8rem' }}>Loading...</span>}
                            <button
                                onClick={() => onDownloadClick(course.id, course.name)}
                                disabled={loadingMaterials}
                                style={{
                                    backgroundColor: '#fff',
                                    color: '#1a73e8',
                                    border: '1px solid #dadce0',
                                    borderRadius: '4px',
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                Download ZIP
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* File Selector Modal */}
            {selectingCourse && filesToSelect && (
                <FileSelector
                    files={filesToSelect}
                    onConfirm={handleConfirmSelection}
                    onCancel={() => { setSelectingCourse(null); setFilesToSelect(null); }}
                />
            )}

            {/* Download Progress Modal */}
            {downloadJob && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 className="modal-title">Downloading {downloadJob.courseName}</h3>

                        {downloadJob.status === 'FAILED' ? (
                            <div style={{ color: 'red' }}>Error: {downloadJob.message}</div>
                        ) : (
                            <>
                                <div className="progress-bar-container">
                                    <div className="progress-bar-fill" style={{ width: `${downloadJob.progress}%` }}></div>
                                </div>
                                <p className="modal-message">{downloadJob.message}</p>
                                <p>{downloadJob.progress}%</p>
                            </>
                        )}

                        {(downloadJob.status === 'COMPLETED' || downloadJob.status === 'FAILED') && (
                            <button
                                onClick={() => setDownloadJob(null)}
                                style={{ marginTop: '16px', padding: '8px 16px', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
