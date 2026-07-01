-- Demo users

INSERT INTO users (email, username, display_name, role, bio)
VALUES
  ('admin@dexmate.ai', 'admin', 'DexBot Admin', 'admin', 'Platform administrator'),
  ('operator@dexmate.ai', 'operator', 'Fleet Operator', 'member', 'Robot fleet operator'),
  ('mod@dexmate.ai', 'moderator', 'Community Moderator', 'moderator', 'Forum and wiki moderator')
ON CONFLICT (email) DO NOTHING;

-- Forum categories

INSERT INTO forum_categories (slug, name, color, icon)
VALUES
  ('operations', 'Operations', '#38bdf8', 'radar'),
  ('engineering', 'Engineering', '#a78bfa', 'cpu'),
  ('support', 'Support', '#fb7185', 'life-buoy')
ON CONFLICT (slug) DO NOTHING;

-- Robots

INSERT INTO robots (
  serial_number,
  name,
  model,
  firmware_version,
  ip_address,
  connection_status,
  config,
  certificate_expires_at
)
VALUES
  (
    'DXB-1001',
    'DexBot Alpha',
    'DX-Industrial-A1',
    '1.8.3',
    '10.0.1.21',
    'online',
    '{"capabilities":["inspect","carry","scan"],"location":"bay-3","max_payload_kg":12}',
    now() + interval '320 days'
  ),
  (
    'DXB-1002',
    'DexBot Beta',
    'DX-Industrial-A1',
    '1.8.1',
    '10.0.1.22',
    'online',
    '{"capabilities":["inspect","weld"],"location":"bay-2","max_payload_kg":8}',
    now() + interval '28 days'
  ),
  (
    'DXB-1003',
    'DexBot Gamma',
    'DX-Warehouse-W2',
    '2.1.0',
    '10.0.1.23',
    'offline',
    '{"capabilities":["carry","sort"],"location":"dock-1","max_payload_kg":30}',
    now() + interval '180 days'
  ),
  (
    'DXB-1004',
    'DexBot Delta',
    'DX-Vision-V1',
    '1.4.9',
    '10.0.1.24',
    'error',
    '{"capabilities":["inspect","ocr","detect_anomaly"],"location":"bay-3","max_payload_kg":5}',
    now() + interval '12 days'
  )
ON CONFLICT (serial_number) DO NOTHING;

-- Initial telemetry samples

INSERT INTO robot_telemetry (
  robot_id,
  battery,
  network_quality,
  error_code,
  joint_positions,
  imu
)
SELECT
  id,
  CASE
    WHEN serial_number = 'DXB-1001' THEN 91
    WHEN serial_number = 'DXB-1002' THEN 76
    WHEN serial_number = 'DXB-1003' THEN 44
    ELSE 18
  END,
  CASE
    WHEN serial_number = 'DXB-1001' THEN 98
    WHEN serial_number = 'DXB-1002' THEN 88
    WHEN serial_number = 'DXB-1003' THEN 0
    ELSE 62
  END,
  CASE
    WHEN serial_number = 'DXB-1004' THEN 'E_CAMERA_PIPELINE'
    ELSE NULL
  END,
  '{"joint_1":0.12,"joint_2":0.45,"joint_3":-0.03}',
  '{"roll":0.01,"pitch":0.02,"yaw":1.24}'
FROM robots;

-- Demo fleet job

INSERT INTO fleet_jobs (
  title,
  status,
  required_capabilities,
  location_constraint,
  deadline,
  payload,
  human_gate_required
)
VALUES
  (
    'Inspect bay 3 for dropped parts',
    'announced',
    ARRAY['inspect', 'detect_anomaly'],
    'bay-3',
    now() + interval '2 hours',
    '{"priority":"high","requested_by":"operator","notes":"Check gripper station and floor area"}',
    true
  );

-- Software hub

INSERT INTO software_packages (name, slug, description, category, featured)
VALUES
  (
    'DexBot Robot Agent',
    'dexbot-robot-agent',
    'Device-side agent for telemetry, command execution and secure cloud connectivity.',
    'robot-runtime',
    true
  ),
  (
    'DexBot Vision Tools',
    'dexbot-vision-tools',
    'Camera ingest, frame sampling and anomaly-detection utilities.',
    'vision',
    false
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO software_versions (
  package_id,
  version,
  platform,
  checksum,
  size_bytes,
  changelog,
  download_url
)
SELECT
  id,
  '1.0.0',
  'linux',
  'sha256-demo-checksum',
  73400320,
  'Initial demo release with robot registration and telemetry upload.',
  's3://dexbot-demo/packages/dexbot-agent-linux-1.0.0.tar.gz'
FROM software_packages
WHERE slug = 'dexbot-robot-agent';