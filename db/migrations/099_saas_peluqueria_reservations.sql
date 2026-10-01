CREATE TABLE IF NOT EXISTS saas_peluqueria_reservations (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reservation_date DATE NOT NULL,
  reservation_time VARCHAR(5) NOT NULL,
  client_name VARCHAR(120) NOT NULL,
  client_phone VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peluqueria_slot (reservation_date, reservation_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
