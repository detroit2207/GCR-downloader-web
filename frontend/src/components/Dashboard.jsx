import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FileSelector from './FileSelector';
import PixelCard from './PixelCard';
import '../Modal.css';

const Dashboard = () => {
    // IMPORTANT: This must point to your BACKEND URL (e.g. gcr-backend.onrender.com)
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
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
                    const res = await axios.get(`${API_URL}/download/status/${downloadJob.id}`, {
                        withCredentials: true
                    });
                    setDownloadJob(prev => ({ ...prev, ...res.data }));

                    if (res.data.status === 'COMPLETED') {
                        // Trigger file download
                        window.location.href = `${API_URL}/download/result/${downloadJob.id}`;
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
            const response = await axios.get(`${API_URL}/courses`, {
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
            const res = await axios.get(`${API_URL}/courses/${courseId}/materials`, { withCredentials: true });
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
            const res = await axios.post(`${API_URL}/courses/${id}/download/start`,
                { courseName: name, selectedFileIds: selectedIds },
                { withCredentials: true }
            );
            setDownloadJob({ id: res.data.job_id, courseName: name, progress: 0, status: 'QUEUED', message: 'Queued...' });
        } catch (err) {
            console.error(err);
            setDownloadJob({ status: 'FAILED', message: 'Failed to start download.' });
        }
    };

    const handleLogout = async () => {
        try {
            await axios.get(`${API_URL}/auth/logout`, { withCredentials: true });
        } catch (err) {
            console.error("Logout failed", err);
        } finally {
            window.location.href = "/";
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading courses...</div>;
    if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: '#9ECE6A' }}>My Courses</h1>
                <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer', color: '#9ECE6A', borderColor: '#9ECE6A' }}>Logout</button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px', width: '100%' }}>
                {courses.map(course => (
                    <PixelCard key={course.id} variant="default" colors="#ff0000ff,#4285f4,#8ab4f8" speed={40}>
                        <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'transparent' }}>
                            <div style={{ height: '100px', backgroundColor: 'transparent', color: '#9ECE6A', padding: '16px', borderBottom: '4px solid #9ECE6A', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <h2 style={{ fontSize: '0.9rem', margin: 0, overflow: 'visible', whiteSpace: 'normal', fontFamily: "'Press Start 2P', monospace", lineHeight: '1.5', maxHeight: '100%', wordBreak: 'break-word' }}>{course.name}</h2>
                                <p style={{ opacity: 0.9, fontSize: '0.7rem', marginTop: '8px' }}>{course.section}</p>
                            </div>
                            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
                                {loadingMaterials && selectingCourse?.id === course.id && <span style={{ marginRight: 10, fontSize: '0.6rem', color: '#000' }}>Loading...</span>}
                                <button
                                    onClick={() => onDownloadClick(course.id, course.name)}
                                    disabled={loadingMaterials}
                                    style={{
                                        backgroundColor: 'transparent',
                                        color: '#9ECE6A',
                                        border: '2px solid #9ECE6A',
                                        boxShadow: '2px 2px 0px 0px #9ECE6A',
                                        borderRadius: '0',
                                        padding: '8px 16px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.7rem',
                                        fontFamily: "'Press Start 2P', monospace"
                                    }}
                                >
                                    Download ZIP
                                </button>
                            </div>
                        </div>
                    </PixelCard>
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
                                style={{ marginTop: '16px', padding: '8px 16px', cursor: 'pointer', backgroundColor: 'transparent', color: '#9ECE6A', border: '2px solid #9ECE6A', fontFamily: "'Press Start 2P', monospace", boxShadow: '2px 2px 0px 0px #9ECE6A', borderRadius: 0 }}
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
