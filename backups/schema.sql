CREATE DATABASE IF NOT EXISTS sensores_riego CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sensores_riego;

CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contrasena_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_completo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol` enum('admin','cliente') COLLATE utf8mb4_unicode_ci NOT NULL,
  `activo` tinyint(1) NOT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `actualizado_en` datetime NOT NULL DEFAULT (now()),
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo` (`correo`),
  KEY `idx_usuarios_correo` (`correo`),
  KEY `idx_usuarios_rol` (`rol`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tipos_cultivo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `actualizado_en` datetime NOT NULL DEFAULT (now()),
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `nombre_empresa` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` text COLLATE utf8mb4_unicode_ci,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `actualizado_en` datetime NOT NULL DEFAULT (now()),
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario_id` (`usuario_id`),
  KEY `idx_clientes_usuario_id` (`usuario_id`),
  CONSTRAINT `clientes_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `predios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ubicacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `actualizado_en` datetime NOT NULL DEFAULT (now()),
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_predios_cliente_id` (`cliente_id`),
  CONSTRAINT `predios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `areas_riego` (
  `id` int NOT NULL AUTO_INCREMENT,
  `predio_id` int NOT NULL,
  `tipo_cultivo_id` int NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tamano_area` decimal(10,2) DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `actualizado_en` datetime NOT NULL DEFAULT (now()),
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_areas_riego_predio_id` (`predio_id`),
  KEY `idx_areas_riego_tipo_cultivo_id` (`tipo_cultivo_id`),
  CONSTRAINT `areas_riego_ibfk_1` FOREIGN KEY (`predio_id`) REFERENCES `predios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `areas_riego_ibfk_2` FOREIGN KEY (`tipo_cultivo_id`) REFERENCES `tipos_cultivo` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nodos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `area_riego_id` int NOT NULL,
  `api_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numero_serie` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `actualizado_en` datetime NOT NULL DEFAULT (now()),
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_key` (`api_key`),
  UNIQUE KEY `area_riego_id` (`area_riego_id`),
  UNIQUE KEY `numero_serie` (`numero_serie`),
  KEY `idx_nodos_api_key` (`api_key`),
  KEY `idx_nodos_area_riego_id` (`area_riego_id`),
  CONSTRAINT `nodos_ibfk_1` FOREIGN KEY (`area_riego_id`) REFERENCES `areas_riego` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ciclos_cultivo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `area_riego_id` int NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `actualizado_en` datetime NOT NULL DEFAULT (now()),
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ciclos_cultivo_area_fechas` (`area_riego_id`,`fecha_fin`),
  KEY `idx_ciclos_cultivo_area_id` (`area_riego_id`),
  CONSTRAINT `ciclos_cultivo_ibfk_1` FOREIGN KEY (`area_riego_id`) REFERENCES `areas_riego` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lecturas` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nodo_id` int NOT NULL,
  `marca_tiempo` datetime NOT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `idx_lecturas_nodo_tiempo` (`nodo_id`,`marca_tiempo`),
  KEY `idx_lecturas_tiempo` (`marca_tiempo`),
  CONSTRAINT `lecturas_ibfk_1` FOREIGN KEY (`nodo_id`) REFERENCES `nodos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lecturas_suelo` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `lectura_id` bigint NOT NULL,
  `conductividad` decimal(8,3) DEFAULT NULL,
  `temperatura` decimal(6,2) DEFAULT NULL,
  `humedad` decimal(6,2) DEFAULT NULL,
  `potencial_hidrico` decimal(8,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lectura_id` (`lectura_id`),
  CONSTRAINT `lecturas_suelo_ibfk_1` FOREIGN KEY (`lectura_id`) REFERENCES `lecturas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lecturas_riego` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `lectura_id` bigint NOT NULL,
  `activo` tinyint(1) DEFAULT NULL,
  `litros_acumulados` decimal(12,2) DEFAULT NULL,
  `flujo_por_minuto` decimal(8,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lectura_id` (`lectura_id`),
  CONSTRAINT `lecturas_riego_ibfk_1` FOREIGN KEY (`lectura_id`) REFERENCES `lecturas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lecturas_ambiental` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `lectura_id` bigint NOT NULL,
  `temperatura` decimal(6,2) DEFAULT NULL,
  `humedad_relativa` decimal(6,2) DEFAULT NULL,
  `velocidad_viento` decimal(7,2) DEFAULT NULL,
  `radiacion_solar` decimal(8,2) DEFAULT NULL,
  `eto` decimal(6,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lectura_id` (`lectura_id`),
  CONSTRAINT `lecturas_ambiental_ibfk_1` FOREIGN KEY (`lectura_id`) REFERENCES `lecturas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tokens_refresco` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `token` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expira_en` datetime NOT NULL,
  `creado_en` datetime NOT NULL DEFAULT (now()),
  `revocado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_tokens_refresco_token` (`token`),
  KEY `idx_tokens_refresco_usuario_id` (`usuario_id`),
  CONSTRAINT `tokens_refresco_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

