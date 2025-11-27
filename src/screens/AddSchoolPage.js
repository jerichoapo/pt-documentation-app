import React from 'react';
import { useLocation } from 'react-router-dom';
import SchoolForm from '../components/SchoolForm';

const AddSchoolPage = () => {
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const returnContext = location.state?.returnContext;
  const prefillSchoolName = location.state?.prefillSchoolName;

  return (
    <SchoolForm
      returnTo={returnTo}
      returnContext={returnContext}
      initialSchoolName={prefillSchoolName}
    />
  );
};

export default AddSchoolPage;
