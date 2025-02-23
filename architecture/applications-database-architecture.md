table_name = 'applications'
[
  {
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "column_default": "gen_random_uuid()",
    "is_nullable": "NO"
  },
  {
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "column_default": null,
    "is_nullable": "YES"
  },
  {
    "column_name": "data",
    "data_type": "jsonb",
    "character_maximum_length": null,
    "column_default": null,
    "is_nullable": "NO"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "column_default": "timezone('utc'::text, now())",
    "is_nullable": "NO"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "column_default": "timezone('utc'::text, now())",
    "is_nullable": "NO"
  },
  {
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null,
    "column_default": "'pending'::text",
    "is_nullable": "NO"
  }
]

table_name='application_details'
[
  {
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null
  },
  {
    "column_name": "user_id",
    "data_type": "uuid",
    "character_maximum_length": null
  },
  {
    "column_name": "data",
    "data_type": "jsonb",
    "character_maximum_length": null
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null
  },
  {
    "column_name": "linked_application_id",
    "data_type": "uuid",
    "character_maximum_length": null
  },
  {
    "column_name": "user_email",
    "data_type": "character varying",
    "character_maximum_length": 255
  },
  {
    "column_name": "linked_name",
    "data_type": "text",
    "character_maximum_length": null
  },
  {
    "column_name": "status",
    "data_type": "text",
    "character_maximum_length": null
  },
  {
    "column_name": "linked_email",
    "data_type": "text",
    "character_maximum_length": null
  },
  {
    "column_name": "linked_user_email",
    "data_type": "character varying",
    "character_maximum_length": 255
  }
]

sample application from application_details:
[
  {
    "id": "9a38c6ac-92c7-4bb4-8e5d-87701fdae976",
    "user_id": "55dd680b-be1b-45b4-9892-72db120cf665",
    "data": {
      "3": "As you wish.",
      "4": "Test",
      "5": "Test",
      "6": "Test",
      "7": "Test",
      "8": "Yes",
      "9": "No",
      "10": "tes",
      "11": "test",
      "12": "test",
      "13": "test",
      "14": [
        {}
      ],
      "15": "test",
      "16": "test",
      "17": "test",
      "18": "test",
      "19": "test",
      "20": "test",
      "21": "test",
      "22": "test",
      "23": "test",
      "24": "test",
      "25": "test",
      "26": "test",
      "27": "test",
      "28": "test",
      "30": "test",
      "32": "Yes, I definitely won't bring an animal with me even though it is super cute.",
      "33": "Yes, I understand and agree to honor this completely"
    },
    "status": "approved",
    "created_at": "2025-02-17 08:39:25.157646+00",
    "updated_at": "2025-02-19 19:58:41.020762+00",
    "user_email": "test@test.test",
    "linked_name": null,
    "linked_email": null,
    "linked_application_id": null,
    "linked_user_email": null
  }
]