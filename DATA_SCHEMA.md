# Everything Tracker - Data Schema

Documentation of all input fields and data structure for the spreadsheet integration.

## Data Structure

### Root Level Fields

```json
{
  "date": "YYYY-MM-DD",
  "sleep": [],
  "caffeine": 0,
  "energy": {},
  "mood": {},
  "anxiety": 0,
  "irritability": 0,
  "note": "",
  "image": null
}
```

---

## Detailed Field Descriptions

### **date** (String)
- **Type**: Date (YYYY-MM-DD format)
- **Source**: Page 1 - Date input
- **Required**: Yes
- **Description**: The date when the data was logged
- **Example**: "2026-02-13"

---

### **sleep** (Array of Boolean)
- **Type**: Array with 48 boolean values
- **Source**: Page 2 - Sleep Tracker
- **Required**: No
- **Description**: 48 sleep slots representing 24 hours with 30-minute intervals
- **Details**:
  - Index 0 = 00:00
  - Index 1 = 00:30
  - Index 2 = 01:00
  - Index 47 = 23:30
  - `true` = asleep, `false` = awake
- **Example**: `[false, false, true, true, true, true, ...]` (48 total)

---

### **caffeine** (Number)
- **Type**: Integer (0-1000+)
- **Source**: Page 3 - Caffeine Tracker
- **Required**: No
- **Description**: Total caffeine intake in milligrams
- **Details**:
  - Starts at 0
  - Increments via buttons (+50, +100, +150)
  - Can be manually edited
  - Final value set by "Done!" button
- **Example**: `350`

---

### **energy** (Object)
- **Type**: Object with two properties
- **Source**: Page 4 - Energy sliders
- **Required**: No

#### **energy.highest** (Number)
- **Type**: Integer (1-7)
- **Description**: Highest energy level experienced during the day
- **Default**: 4

#### **energy.lowest** (Number)
- **Type**: Integer (1-7)
- **Description**: Lowest energy level experienced during the day
- **Default**: 4

**Example**:
```json
{
  "highest": 6,
  "lowest": 2
}
```

---

### **mood** (Object)
- **Type**: Object with two properties
- **Source**: Page 4 - Mood sliders
- **Required**: No

#### **mood.highest** (Number)
- **Type**: Integer (1-7)
- **Description**: Best mood during the day
- **Default**: 4

#### **mood.lowest** (Number)
- **Type**: Integer (1-7)
- **Description**: Worst mood during the day
- **Default**: 4

**Example**:
```json
{
  "highest": 7,
  "lowest": 3
}
```

---

### **anxiety** (Number)
- **Type**: Integer (1-7)
- **Source**: Page 4 - Anxiety slider
- **Required**: No
- **Description**: Overall anxiety level for the day
- **Default**: 4
- **Example**: `5`

---

### **irritability** (Number)
- **Type**: Integer (1-7)
- **Source**: Page 4 - Irritability slider
- **Required**: No
- **Description**: Overall irritability level for the day
- **Default**: 4
- **Example**: `3`

---

### **note** (String)
- **Type**: Text (unlimited length)
- **Source**: Page 5 - Note text area
- **Required**: No
- **Description**: Free-form note or journal entry for the day
- **Example**: "Had a great day! Felt productive in the morning."

---

### **image** (File/String)
- **Type**: File object or Base64 string
- **Source**: Page 5 - Image file input
- **Required**: No
- **Description**: Optional image attachment for the daily entry
- **Details**:
  - Accepts: jpg, png, gif, webp, etc.
  - Can be converted to Base64 for storage
  - For Google Sheets: Store as URL or attachment
- **Example**: `File { name: "photo.jpg", size: 245680, ... }`

---

## Google Sheets Column Mapping

Recommended column structure for Google Sheets:

| Column | Header | Data Type | Notes |
|--------|--------|-----------|-------|
| A | Date | Date | YYYY-MM-DD |
| B-Y | Sleep (00:00-23:30) | Boolean | 48 columns (TRUE/FALSE) |
| Z | Caffeine (mg) | Number | 0-1000+ |
| AA | Energy Highest | Number | 1-7 |
| AB | Energy Lowest | Number | 1-7 |
| AC | Mood Highest | Number | 1-7 |
| AD | Mood Lowest | Number | 1-7 |
| AE | Anxiety | Number | 1-7 |
| AF | Irritability | Number | 1-7 |
| AG | Note | Text | Long text field |
| AH | Image | URL/Attachment | Link or embedded image |

---

## Integration Requirements

### For Google Sheets:
1. Use Google Apps Script with Sheets API
2. Separate sheet columns for each sleep slot (00:00, 00:30, 01:00, etc.)
3. Use dropdown menus for 1-7 scale fields
4. Consider data validation for accuracy

### For Database:
1. Store sleep array as JSON string or separate table
2. Use JSONB if supported (PostgreSQL)
3. Consider indexing on date for quick retrieval
4. Store images as URLs or base64 strings

### Data Submission:
- Create endpoint that accepts POST requests
- Validate all inputs before storage
- Return confirmation to user
- Store timestamp of submission

---

## Example Complete Entry

```json
{
  "date": "2026-02-13",
  "sleep": [false, false, true, true, true, true, true, true, true, true, true, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  "caffeine": 350,
  "energy": {
    "highest": 6,
    "lowest": 2
  },
  "mood": {
    "highest": 7,
    "lowest": 3
  },
  "anxiety": 5,
  "irritability": 3,
  "note": "Great productive day! Morning was energetic, afternoon dip, evening recovered. Drank 3 cups of coffee before noon.",
  "image": null
}
```

---

## Notes

- All slider fields (1-7) have a default value of 4 (neutral)
- Sliders activate a visual gradient when moved from default
- Sleep data represents 48 × 30-minute intervals over 24 hours
- Image field requires handling for file upload/conversion
- Consider adding timestamps for each modification in production
