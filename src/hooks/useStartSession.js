import { useNavigate } from 'react-router-dom';
import { toDateInputValue } from '../utils/sessionFormatting';

export const useStartSession = () => {
  const navigate = useNavigate();

  const startSession = (patientId, options = {}) => {
    const { referrer = 'profile', sessionDate = null, copyFrom = null } = options;
    const params = new URLSearchParams({ referrer });
    if (sessionDate) {
      params.set('date', toDateInputValue(sessionDate));
    }
    if (copyFrom) {
      params.set('copyFrom', copyFrom);
    }
    navigate(`/sessions/new/${patientId}/subjective?${params.toString()}`);
  };

  return startSession;
};
