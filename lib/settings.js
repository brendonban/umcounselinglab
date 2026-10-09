/* Lab settings. The same limits are enforced on the server in firestore.rules,
   so if you change hours, rooms, purposes or limits here, change them there too. */
export const SETTINGS = {
  labName: "UM Counseling Lab",
  hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  openDays: [0, 1, 2, 3, 4, 5, 6],
  minDaysAhead: 1,
  daysAhead: 14,
  maxUpcoming: 3,
  maxHours: 4,
  allowedDomains: ["siswa.um.edu.my", "um.edu.my"],
  rooms: [1, 2, 3, 4, 5, 6, 7, 8, 10].map(n => ({ id: String(n), name: "Room " + n, type: n === 1 || n === 10 ? "group" : "individual" })),
  purposes: [
    { name: "Individual counselling session", maxHours: 1, roomType: "individual" },
    { name: "Group counselling session", maxHours: 2, roomType: "group" },
    { name: "Role-play / skills practice", maxHours: 1, roomType: "individual" },
    { name: "Supervision session", maxHours: 1, roomType: "individual" },
    { name: "Other academic purpose", maxHours: 1, roomType: "individual" },
  ],
  contact: "",
};

// Text shown around the site.
export const SITE = {
  LAB_NAME: "UM Counseling Lab",
  LOCATION: "Counseling Lab, Level 03, Menara Pendidikan, UM",
  ADDRESS: "Level 03, Menara Pendidikan, Universiti Malaya",
  HOURS: "Monday to Sunday, 9.00 am – 9.00 pm",
  COORDINATOR: "", // the person in charge's name, e.g. "Dr Lim"
  CONTACT: "",     // their phone or email
  DEVELOPER_NAME: "Brendon Ban",
  DEVELOPER_EMAIL: "22059169@siswa.um.edu.my",
};
