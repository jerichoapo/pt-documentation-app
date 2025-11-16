import { useNavigate } from 'react-router-dom';

export const useStartSession = () => {
  const navigate = useNavigate();

  const startSession = (patientId) => {
    navigate(`/sessions/new/${patientId}/subjective`);
  };

  return startSession;
};
