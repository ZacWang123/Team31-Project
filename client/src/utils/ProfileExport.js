// src/saves/profileExport.js
export const generateConsultantReport = (formData, savedPackages, viewedPackages, topSavedFilters, FILTER_OPTIONS, formatLocationPath) => {
  const { fullName, email, mobile } = formData;

  let consultantReport = `========================================\n`;
  consultantReport += `FLIGHT CENTRE - CLIENT TRAVEL PROFILE\n`;
  consultantReport += `========================================\n`;
  consultantReport += `Generated Date: ${new Date().toLocaleString()}\n\n`;

  consultantReport += `[ CLIENT INFORMATION ]\n`;
  consultantReport += `Full Name: ${fullName}\n`;
  consultantReport += `Email Address: ${email || 'Not provided'}\n`;
  consultantReport += `Mobile Number: ${mobile || 'Not provided'}\n\n`;

  consultantReport += `[ TRAVEL PREFERENCES (PLACEHOLDERS) ]\n`;
  consultantReport += `- Climate: Not specified\n`;
  consultantReport += `- Price Range: Not specified\n`;
  consultantReport += `- Travel Style: Not specified\n\n`;

  consultantReport += `[ FAVOURITE ACTIVITIES ]\n`;
  if (topSavedFilters && topSavedFilters.length > 0) {
    topSavedFilters.forEach((tagId) => {
      const filterObj = FILTER_OPTIONS.find((f) => f.id === tagId);
      consultantReport += `- ${filterObj ? filterObj.label : tagId}\n`;
    });
  } else {
    consultantReport += `- None recorded\n`;
  }
  consultantReport += `\n`;

  consultantReport += `[ RECENTLY VIEWED PACKAGES ]\n`;
  if (viewedPackages && viewedPackages.length > 0) {
    viewedPackages.slice(0, 5).forEach((pkg, index) => {
      consultantReport += `${index + 1}. ${pkg.packageName || pkg.title}\n`;
    });
  } else {
    consultantReport += `- None recorded\n`;
  }
  consultantReport += `\n`;

  consultantReport += `[ DESTINATION SHORTLIST (${savedPackages.length} items) ]\n`;
  if (savedPackages && savedPackages.length > 0) {
    savedPackages.forEach((pkg, index) => {
      const title = pkg.packageName || pkg.title || pkg.name || 'Package';
      const location = formatLocationPath ? formatLocationPath(pkg) : '';
      consultantReport += `${index + 1}. ${title} [${location}]\n`;
    });
  } else {
    consultantReport += `- Shortlist is empty\n`;
  }
  consultantReport += `========================================\n`;

  // Trigger browser download
  const blob = new Blob([consultantReport], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `TravelProfile_${fullName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
};