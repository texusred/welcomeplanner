# ARU Students' Union Welcome Fair Stall Finder

A comprehensive web application for locating stallholders at the ARU Students' Union Welcome Fair. Designed for staff to quickly find stall locations on event day, with organiser tools for setup and management.

## 🌟 Features

### For Staff (Event Day Use)
- **Quick Search**: Real-time autocomplete search with stall numbers and locations
- **Interactive Maps**: Visual courtyard maps with highlighted stall positions
- **Stall Details**: Complete information including neighbours and group types
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode**: Toggle between light and dark themes

### For Organisers
- **Stallholder Editor**: Add, edit, and manage all stallholder data
- **Map Builder**: Visual drag-and-drop tool for creating courtyard layouts
- **Data Export**: Export stallholder data as JSON
- **Real-time Updates**: Live editing with instant visual feedback

## 🗂️ Project Structure

```
├── index.html              # Main stall finder interface
├── script.js               # Core application logic
├── styles.css              # Responsive styling and theming
├── data/
│   └── stallholders.json   # Stallholder database
├── maps/                   # Interactive courtyard maps
│   ├── ruskin-courtyard.html
│   ├── science-walkway.html
│   └── lab-courtyard.html
├── admin/                  # Organiser tools
│   ├── admin-dashboard.html
│   ├── stallholder-editor.html
│   ├── map-builder.html
│   ├── map-builder.css
│   └── map-builder.js
└── assets/
    └── images/
        └── logo.jpg
```

## 📱 Usage

### Finding Stalls (Staff)
1. Type stallholder name in the search box
2. Select from autocomplete suggestions
3. View stall details and location
4. Click "View on Map" to see exact position

### Event Management (Organisers)
1. Access organiser tools via the "Admin Tools" button
2. Edit stallholder data in real-time
3. Use Map Builder to create/modify layouts
4. Export data for backup or integration

## 🎨 Customisation

- **Branding**: Update colours in CSS variables (`:root` section)
- **Locations**: Add new courtyards by creating map HTML files
- **Data**: Modify `stallholders.json` structure as needed

## 📋 Data Format

```json
{
  "name": "Computer Science",
  "stallNumber": 19,
  "location": "Ruskin Courtyard",
  "group": "Society"
}
```

## 📄 Licence

This project is developed for ARU Students' Union internal use.
