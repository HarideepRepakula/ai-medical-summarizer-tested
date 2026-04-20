import { useState } from "react";
import "./UploadRecord.css";

const UploadRecord = ({ onClose, onSuccess }) => {
	const [selectedFile, setSelectedFile] = useState(null);
	const [recordName, setRecordName] = useState("");
	const [serviceDate, setServiceDate] = useState("");
	const [associatedDoctor, setAssociatedDoctor] = useState("");
	const [dragActive, setDragActive] = useState(false);
	const [showSuccess, setShowSuccess] = useState(false);
	const [uploading, setUploading] = useState(false);

	const handleDrag = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	};

	const handleDrop = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			setSelectedFile(e.dataTransfer.files[0]);
		}
	};

	const handleFileSelect = (e) => {
		if (e.target.files && e.target.files[0]) {
			setSelectedFile(e.target.files[0]);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setUploading(true);
		
		try {
			// Simulate upload delay
			await new Promise(resolve => setTimeout(resolve, 1500));
			
			// Show success state
			setShowSuccess(true);
			setUploading(false);
			
			// Auto close after 2 seconds and call onSuccess
			setTimeout(() => {
				if (onSuccess && selectedFile) {
					// Create file URL for download
					const fileUrl = URL.createObjectURL(selectedFile);
					
					onSuccess({
						recordName,
						serviceDate,
						associatedDoctor,
						fileName: selectedFile.name,
						fileType: selectedFile.type?.includes('pdf') ? 'pdf' : 'image',
						fileData: fileUrl,
						fileUrl: fileUrl
					});
				}
				onClose();
			}, 2000);
		} catch (error) {
			setUploading(false);
			console.error('Upload failed:', error);
		}
	};

	if (showSuccess) {
		return (
			<div className="upload-modal-overlay">
				<div className="upload-modal">
					<div className="success-content" style={{ textAlign: 'center', padding: '3rem' }}>
						<div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
						<h2 style={{ color: '#10B981', marginBottom: '1rem' }}>Upload Successful!</h2>
						<p style={{ color: '#64748B' }}>Your medical record has been uploaded successfully.</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="upload-modal-overlay">
			<div className="upload-modal">
				<div className="upload-header">
					<h2 className="upload-title">Upload New Medical Record</h2>
					<button onClick={onClose} className="upload-close-btn">×</button>
				</div>

				<form onSubmit={handleSubmit} className="upload-form">
					<div 
						className={`drop-zone ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
						onDragEnter={handleDrag}
						onDragLeave={handleDrag}
						onDragOver={handleDrag}
						onDrop={handleDrop}
						onClick={() => document.getElementById('file-input').click()}
					>
						<input
							id="file-input"
							type="file"
							accept=".pdf,.jpg,.jpeg,.png,.dcm"
							onChange={handleFileSelect}
							style={{ display: 'none' }}
						/>
						<div className="drop-zone-content">
							<div className="upload-icon">📁</div>
							{selectedFile ? (
								<div className="file-selected">
									<p className="file-name">{selectedFile.name}</p>
									<p className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
								</div>
							) : (
								<div className="drop-zone-text">
									<p className="drag-text">Drag & Drop Files Here</p>
									<p className="or-text">or</p>
									<p className="click-text"><span className="click-link">Click to Select Files</span></p>
								</div>
							)}
							<p className="supported-formats">Supported formats: PDF, JPG, PNG, DICOM</p>
						</div>
					</div>

					<div className="metadata-fields">
						<div className="form-group">
							<label className="form-label">Record Name/Title *</label>
							<input
								type="text"
								value={recordName}
								onChange={(e) => setRecordName(e.target.value)}
								placeholder="e.g., X-Ray Scan - 2025-01-15"
								className="upload-input"
								required
							/>
						</div>

						<div className="form-group">
							<label className="form-label">Date of Service *</label>
							<input
								type="date"
								value={serviceDate}
								onChange={(e) => setServiceDate(e.target.value)}
								max={new Date().toISOString().split('T')[0]}
								className="upload-input"
								required
							/>
							<p className="date-hint">Select a date on or before today</p>
						</div>

						<div className="form-group">
							<label className="form-label">Associated Doctor (Optional)</label>
							<select
								value={associatedDoctor}
								onChange={(e) => setAssociatedDoctor(e.target.value)}
								className="upload-select"
							>
								<option value="">Select a doctor</option>
								<option value="dr-johnson">Dr. Sarah Johnson</option>
								<option value="dr-chen">Dr. Michael Chen</option>
								<option value="dr-davis">Dr. Emily Davis</option>
							</select>
						</div>
					</div>

					<div className="upload-actions">
						<button type="button" onClick={onClose} className="cancel-btn">
							Cancel
						</button>
						<button 
							type="submit" 
							disabled={!selectedFile || !recordName || !serviceDate || uploading}
							className="upload-submit-btn"
						>
							{uploading ? 'Uploading...' : 'Upload Record'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default UploadRecord;