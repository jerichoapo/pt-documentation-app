import { useNavigate } from 'react-router-dom';

export const useStartSession = () => {
  const navigate = useNavigate();

  const startSession = (patientId, referrer = 'profile') => {
    const url = `/sessions/new/${patientId}/subjective?referrer=${referrer}`;
    navigate(url);
  };

  return startSession;
};
