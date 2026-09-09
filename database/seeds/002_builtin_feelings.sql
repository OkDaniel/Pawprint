INSERT INTO feelings (slug, name, is_builtin, created_by_user_id, is_active) VALUES
  ('happy', 'Happy', TRUE, NULL, TRUE), ('grateful', 'Grateful', TRUE, NULL, TRUE),
  ('confident', 'Confident', TRUE, NULL, TRUE), ('optimistic', 'Optimistic', TRUE, NULL, TRUE),
  ('excited', 'Excited', TRUE, NULL, TRUE), ('loved', 'Loved', TRUE, NULL, TRUE),
  ('hopeful', 'Hopeful', TRUE, NULL, TRUE), ('calm', 'Calm', TRUE, NULL, TRUE),
  ('content', 'Content', TRUE, NULL, TRUE), ('proud', 'Proud', TRUE, NULL, TRUE),
  ('okay', 'Okay', TRUE, NULL, TRUE), ('bored', 'Bored', TRUE, NULL, TRUE),
  ('confused', 'Confused', TRUE, NULL, TRUE), ('tired', 'Tired', TRUE, NULL, TRUE),
  ('restless', 'Restless', TRUE, NULL, TRUE), ('uncertain', 'Uncertain', TRUE, NULL, TRUE),
  ('anxious', 'Anxious', TRUE, NULL, TRUE), ('stressed', 'Stressed', TRUE, NULL, TRUE),
  ('exhausted', 'Exhausted', TRUE, NULL, TRUE), ('upset', 'Upset', TRUE, NULL, TRUE),
  ('overwhelmed', 'Overwhelmed', TRUE, NULL, TRUE), ('frustrated', 'Frustrated', TRUE, NULL, TRUE),
  ('sad', 'Sad', TRUE, NULL, TRUE), ('angry', 'Angry', TRUE, NULL, TRUE),
  ('lonely', 'Lonely', TRUE, NULL, TRUE), ('guilty', 'Guilty', TRUE, NULL, TRUE),
  ('scared', 'Scared', TRUE, NULL, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_builtin = TRUE, created_by_user_id = NULL, is_active = TRUE;
