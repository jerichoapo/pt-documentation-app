import { useNavigate } from 'react-router-dom';
import { toDateInputValue } from '../utils/sessionFormatting';

export const useStartSession = () => {
  const navigate = useNavigate();

  const startSession = (patientId, referrer = 'profile', sessionDate = null) => {
    const params = new URLSearchParams({ referrer });
    if (sessionDate) {
      params.set('date', toDateInputValue(sessionDate));
    }
    navigate(`/sessions/new/${patientId}/subjective?${params.toString()}`);
  };

  return startSession;
};
