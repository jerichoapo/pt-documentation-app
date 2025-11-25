// Export utilities for patient notes to PDF and DOCX formats

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';

// Initialize pdfMake with fonts
if (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
} else if (pdfFonts && pdfFonts.default && pdfFonts.default.pdfMake) {
  pdfMake.vfs = pdfFonts.default.pdfMake.vfs;
}

// Helper function to format SOAP note content
const formatSOAPContent = (session, patient, provider) => {
  const sessionDate = new Date(session.sessionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const timeRange = session.startTime && session.endTime
    ? `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`
    : 'N/A';

  const providerName = provider ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim() : 'N/A';
  const credentials = provider?.credentials ? `, ${provider.credentials.join(', ')}` : '';
  const licenseNumber = provider?.license ? `License Number: ${provider.license}` : '';
  const signatureName = providerName !== 'N/A' ? providerName : '';

  return {
    patientName: `${patient.firstName} ${patient.lastName}`,
    sessionDate,
    timeRange,
    subjective: session.subjective || 'N/A',
    objective: {
      categories: session.objectiveCategories || {},
      notes: session.objectiveNotes || 'N/A'
    },
    assessment: session.assessment || 'N/A',
    plan: session.plan || 'N/A',
    providerName: `${providerName}${credentials}`,
    signatureName,
    licenseNumber
  };
};

// Helper function to format time
const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Helper function to get objective categories text
const getObjectiveCategoriesText = (categories, lineBreaks = '\n\n') => {
  if (!categories || Object.values(categories).every(val => !val)) {
    return '';
  }

  const categoryLabels = {
    balance: 'Balance & Coordination',
    motorSkills: 'Gross Motor Skills',
    therapeuticActivities: 'Therapeutic Activities',
    transfers: 'Transfers & Positioning',
    classroomMobility: 'Classroom Mobility'
  };

  const activeCategories = Object.entries(categories)
    .filter(([key, isSelected]) => isSelected)
    .map(([key]) => categoryLabels[key] || key);

  return activeCategories.length > 0 ? `Objective Categories: ${activeCategories.join(', ')}${lineBreaks}` : '';
};

// PDF Export Functions
export const exportSingleNoteToPDF = async (session, patient, provider) => {
  const content = formatSOAPContent(session, patient, provider);

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    content: [
      // Patient and Session Info
      {
        text: content.patientName,
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      {
        text: `Date of Service: ${content.sessionDate}`,
        style: 'subheader',
        margin: [0, 0, 0, 20]
      },

      // SOAP Sections
      {
        text: 'SUBJECTIVE',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: content.subjective,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      {
        text: 'OBJECTIVE',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: getObjectiveCategoriesText(content.objective.categories, '\n') + content.objective.notes,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      {
        text: 'ASSESSMENT',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: content.assessment,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      {
        text: 'PLAN',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: content.plan,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      // Provider Info
      {
        text: `Provider: ${content.providerName}`,
        style: 'providerInfo',
        margin: [0, 20, 0, 5]
      },
      {
        text: content.signatureName,
        style: 'signature',
        margin: [0, 5, 0, 5]
      },
      {
        text: content.licenseNumber,
        style: 'providerInfo',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Electronically signed',
        style: 'disclaimer'
      }
    ],
    styles: {
      header: {
        fontSize: 24,
        bold: true,
        color: '#333'
      },
      subheader: {
        fontSize: 14,
        bold: true,
        color: '#666'
      },
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: '#333',
        background: '#f0f0f0',
        padding: 5
      },
      bodyText: {
        fontSize: 12,
        lineHeight: 1.4
      },
      providerInfo: {
        fontSize: 12,
        italics: true,
        color: '#666'
      },
      signature: {
        fontSize: 16,
        italics: true,
        decoration: 'underline',
        color: '#333'
      },
      disclaimer: {
        fontSize: 9,
        color: '#999'
      }
    }
  };

  return new Promise((resolve, reject) => {
    try {
      const fileName = `Note_${content.patientName.replace(/\s+/g, '_')}_${content.sessionDate.replace(/\s+/g, '_')}.pdf`;
      pdfMake.createPdf(docDefinition).getBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      }, reject);
    } catch (error) {
      reject(error);
    }
  });
};

export const exportBulkNotesToPDF = async (sessions, patient, provider) => {
  const content = formatSOAPContent(sessions[0], patient, provider);

  const docContent = [];

  sessions.forEach((session, index) => {
    const sessionContent = formatSOAPContent(session, patient, provider);

    if (index > 0) {
      // Add page break between sessions
      docContent.push({ text: '', pageBreak: 'before' });
    }

    docContent.push(
      // Patient and Session Info
      {
        text: sessionContent.patientName,
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      {
        text: `Date of Service: ${sessionContent.sessionDate}`,
        style: 'subheader',
        margin: [0, 0, 0, 20]
      },

      // SOAP Sections
      {
        text: 'SUBJECTIVE',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: sessionContent.subjective,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      {
        text: 'OBJECTIVE',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: getObjectiveCategoriesText(sessionContent.objective.categories, '\n') + sessionContent.objective.notes,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      {
        text: 'ASSESSMENT',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: sessionContent.assessment,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      {
        text: 'PLAN',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10]
      },
      {
        text: sessionContent.plan,
        style: 'bodyText',
        margin: [0, 0, 0, 20]
      },

      // Provider Info
      {
        text: `Provider: ${sessionContent.providerName}`,
        style: 'providerInfo',
        margin: [0, 20, 0, 5]
      },
      {
        text: sessionContent.signatureName,
        style: 'signature',
        margin: [0, 5, 0, 5]
      },
      {
        text: sessionContent.licenseNumber,
        style: 'providerInfo',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Electronically signed',
        style: 'disclaimer',
        margin: [0, 0, 0, 30] // Extra margin for separation
      }
    );
  });

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    content: docContent,
    styles: {
      header: {
        fontSize: 24,
        bold: true,
        color: '#333'
      },
      subheader: {
        fontSize: 14,
        bold: true,
        color: '#666'
      },
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: '#333',
        background: '#f0f0f0',
        padding: 5
      },
      bodyText: {
        fontSize: 12,
        lineHeight: 1.4
      },
      providerInfo: {
        fontSize: 12,
        italics: true,
        color: '#666'
      },
      signature: {
        fontSize: 16,
        italics: true,
        decoration: 'underline',
        color: '#333'
      },
      disclaimer: {
        fontSize: 9,
        color: '#999'
      }
    }
  };

  return new Promise((resolve, reject) => {
    try {
      const fileName = `Notes_${content.patientName.replace(/\s+/g, '_')}_All_Sessions.pdf`;
      pdfMake.createPdf(docDefinition).getBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      }, reject);
    } catch (error) {
      reject(error);
    }
  });
};

// DOCX Export Functions
export const exportSingleNoteToDOCX = async (session, patient, provider) => {
  const content = formatSOAPContent(session, patient, provider);

  const children = [];

  // Patient and Session Info
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: content.patientName,
          size: 32,
          bold: true
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Date of Service: ${content.sessionDate}`,
          bold: true
        })
      ],
      spacing: { after: 400 }
    })
  );

  // SOAP Sections
  const sections = [
    { title: 'SUBJECTIVE', content: content.subjective },
    { title: 'OBJECTIVE', content: null }, // Special handling for objective
    { title: 'ASSESSMENT', content: content.assessment },
    { title: 'PLAN', content: content.plan }
  ];

  sections.forEach(section => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: 24
          })
        ],
        spacing: { after: 200 }
      })
    );

      if (section.title === 'OBJECTIVE') {
        // Handle objective section with categories
        const categoriesText = getObjectiveCategoriesText(content.objective.categories, '\n');
        const objectiveChildren = [];

        if (categoriesText) {
          objectiveChildren.push(
            new TextRun({
              text: categoriesText.replace(/\n+$/, ''),
              size: 22
            }),
            new TextRun({
              text: '',
              break: 1,
              size: 22
            })
          );
        }

        objectiveChildren.push(
          new TextRun({
            text: content.objective.notes,
            size: 22
          })
        );

      children.push(
        new Paragraph({
          children: objectiveChildren,
          spacing: { after: 400 }
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.content,
              size: 22
            })
          ],
          spacing: { after: 400 }
        })
      );
    }
  });

  // Provider Info
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Provider: ${content.providerName}`,
          italics: true,
          size: 22
        })
      ],
      spacing: { after: 100 }
    })
  );

  // Signature
  if (content.signatureName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content.signatureName,
            font: 'Brush Script MT',
            size: 32,
            italics: true
          })
        ],
        spacing: { after: 100 }
      })
    );
  }

  if (content.licenseNumber) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content.licenseNumber,
            italics: true,
            size: 22
          })
        ],
        spacing: { after: 100 }
      })
    );
  }

  // Disclaimer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Electronically signed',
          size: 18,
          color: '999999'
        })
      ]
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  return new Promise((resolve, reject) => {
    try {
      Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Note_${content.patientName.replace(/\s+/g, '_')}_${content.sessionDate.replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const exportBulkNotesToDOCX = async (sessions, patient, provider) => {
  const content = formatSOAPContent(sessions[0], patient, provider);

  const children = [];

  sessions.forEach((session, index) => {
    const sessionContent = formatSOAPContent(session, patient, provider);

    if (index > 0) {
      // Add page break between sessions
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          pageBreakBefore: true
        })
      );
    }

    // Patient and Session Info
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sessionContent.patientName,
            size: 32,
            bold: true
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Date of Service: ${sessionContent.sessionDate}`,
            bold: true
          })
        ],
        spacing: { after: 400 }
      })
    );

    // SOAP Sections
    const sections = [
      { title: 'SUBJECTIVE', content: sessionContent.subjective },
      { title: 'OBJECTIVE', content: null }, // Special handling for objective
      { title: 'ASSESSMENT', content: sessionContent.assessment },
      { title: 'PLAN', content: sessionContent.plan }
    ];

    sections.forEach(section => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.title,
              bold: true,
              size: 24
            })
          ],
          spacing: { after: 200 }
        })
      );

      if (section.title === 'OBJECTIVE') {
        // Handle objective section with categories
        const categoriesText = getObjectiveCategoriesText(sessionContent.objective.categories, '\n');
        const objectiveChildren = [];

        if (categoriesText) {
          objectiveChildren.push(
            new TextRun({
              text: categoriesText.replace(/\n+$/, ''),
              size: 22
            }),
            new TextRun({
              text: '',
              break: 1,
              size: 22
            })
          );
        }

        objectiveChildren.push(
          new TextRun({
            text: sessionContent.objective.notes,
            size: 22
          })
        );

        children.push(
          new Paragraph({
            children: objectiveChildren,
            spacing: { after: 400 }
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content,
                size: 22
              })
            ],
            spacing: { after: 400 }
          })
        );
      }
    });

    // Provider Info
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Provider: ${sessionContent.providerName}`,
            italics: true,
            size: 22
          })
        ],
        spacing: { after: 100 }
      })
    );

    // Signature
    if (sessionContent.signatureName) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: sessionContent.signatureName,
              font: 'Brush Script MT',
              size: 32,
              italics: true
            })
          ],
          spacing: { after: 100 }
        })
      );
    }

    if (sessionContent.licenseNumber) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: sessionContent.licenseNumber,
              italics: true,
              size: 22
            })
          ],
          spacing: { after: 100 }
        })
      );
    }

    // Disclaimer
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Electronically signed',
            size: 18,
            color: '999999'
          })
        ],
        spacing: { after: 600 } // Extra spacing for session separation
      })
    );
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  return new Promise((resolve, reject) => {
    try {
      Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Notes_${content.patientName.replace(/\s+/g, '_')}_All_Sessions.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
};
