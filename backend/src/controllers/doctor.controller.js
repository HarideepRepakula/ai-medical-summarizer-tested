import { DoctorModel } from "../models/Doctor.js";
import { UserModel } from "../models/User.js";

export async function getDoctors(req, res) {
	try {
		const { specialty } = req.query;
		const filter = specialty ? { specialty: new RegExp(specialty, 'i') } : {};
		
		const doctors = await DoctorModel.find(filter)
			.populate('userId', 'name email phone')
			.sort({ rating: -1 });

		const formattedDoctors = doctors.map(doctor => ({
			id: doctor._id,
			name: doctor.userId.name,
			email: doctor.userId.email,
			phone: doctor.userId.phone,
			specialty: doctor.specialty,
			experience: doctor.experience,
			rating: doctor.rating,
			consultationFee: doctor.consultationFee,
			image: doctor.image || `https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face`,
			availability: doctor.availability
		}));

		res.json({ doctors: formattedDoctors });
	} catch (error) {
		console.error('Get doctors error:', error);
		res.status(500).json({ error: 'Failed to fetch doctors' });
	}
}

export async function getDoctorById(req, res) {
	try {
		const { id } = req.params;
		const doctor = await DoctorModel.findById(id).populate('userId', 'name email phone');
		
		if (!doctor) {
			return res.status(404).json({ error: 'Doctor not found' });
		}

		const formattedDoctor = {
			id: doctor._id,
			name: doctor.userId.name,
			email: doctor.userId.email,
			phone: doctor.userId.phone,
			specialty: doctor.specialty,
			experience: doctor.experience,
			rating: doctor.rating,
			consultationFee: doctor.consultationFee,
			image: doctor.image || `https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face`,
			availability: doctor.availability
		};

		res.json({ doctor: formattedDoctor });
	} catch (error) {
		console.error('Get doctor error:', error);
		res.status(500).json({ error: 'Failed to fetch doctor' });
	}
}