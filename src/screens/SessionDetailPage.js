import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { useSession, usePatient } from '../context/PatientDataContext';

const SessionDetailPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = useSession(sessionId);
  const patient = usePatient(session?.patientId ?? '');

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getSessionDurationMinutes = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes ? endMinutes - startMinutes : 0;
  };

  const formatDuration = (minutes) => {
    if (minutes <= 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) {
      return `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    } else if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Session Not Found</h2>
        <p className="text-gray-600">The session you're looking for could not be found.</p>
        <Link
          to="/"
          className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (!patient || !patient.id) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Patient Not Found</h2>
        <p className="text-gray-600">The patient associated with this session could not be found.</p>
        <Link
          to="/"
          className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to={`/patients/${patient.id}`}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to {patient.firstName} {patient.lastName}
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="mb-6 pb-4 border-b-2">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            SOAP Note
          </h1>
          <p className="text-lg text-gray-700 mb-4">
            {patient.firstName} {patient.lastName} • {patient.diagnosis}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>{formatDate(new Date(session.sessionDate))}</span>
            </div>
            {getSessionDurationMinutes(session.startTime, session.endTime) > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>{formatDuration(getSessionDurationMinutes(session.startTime, session.endTime))}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {/* Subjective */}
          <div className="border-l-4 border-purple-600 pl-6">
            <h3 className="text-xl font-bold text-purple-600 mb-3">SUBJECTIVE</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.subjective || 'No subjective notes recorded.'}
            </div>
          </div>

          {/* Objective */}
          <div className="border-l-4 border-blue-600 pl-6">
            <h3 className="text-xl font-bold text-blue-600 mb-3">OBJECTIVE</h3>

            {/* Categories */}
            {session.objectiveCategories && Object.values(session.objectiveCategories).some(Boolean) && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Assessment Categories:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(session.objectiveCategories).map(([key, isSelected]) => {
                    if (!isSelected) return null;

                    const categoryLabels = {
                      balance: 'Balance & Coordination',
                      motorSkills: 'Gross Motor Skills',
                      therapeuticActivities: 'Therapeutic Activities',
                      transfers: 'Transfers & Positioning',
                      classroomMobility: 'Classroom Mobility'
                    };

                    return (
                      <span
                        key={key}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        {categoryLabels[key] || key}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Objective Notes */}
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.objectiveNotes || 'No objective observations recorded.'}
            </div>
          </div>

          {/* Assessment */}
          <div className="border-l-4 border-orange-600 pl-6">
            <h3 className="text-xl font-bold text-orange-600 mb-3">ASSESSMENT</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.assessment || 'No assessment recorded.'}
            </div>
          </div>

          {/* Plan */}
          <div className="border-l-4 border-green-600 pl-6">
            <h3 className="text-xl font-bold text-green-600 mb-3">PLAN</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.plan || 'No treatment plan recorded.'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-center gap-4">
        <Link
          to={`/patients/${patient.id}`}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Patient
        </Link>
        <Link
          to="/"
          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium"
        >
          Home
        </Link>
      </div>
    </div>
  );
};

export default SessionDetailPage;
