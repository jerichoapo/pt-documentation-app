import React from 'react';
import { useParams } from 'react-router-dom';
import SchoolForm from '../components/SchoolForm';

const EditSchoolPage = () => {
  const { schoolId } = useParams();

  return <SchoolForm schoolId={schoolId} isEdit={true} />;
};

export default EditSchoolPage;
