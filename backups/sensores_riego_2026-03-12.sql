-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: sensores_riego
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alembic_version`
--

DROP TABLE IF EXISTS `alembic_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alembic_version`
--

LOCK TABLES `alembic_version` WRITE;
/*!40000 ALTER TABLE `alembic_version` DISABLE KEYS */;
INSERT INTO `alembic_version` VALUES ('e26372e1d878');
/*!40000 ALTER TABLE `alembic_version` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `areas_riego`
--

DROP TABLE IF EXISTS `areas_riego`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areas_riego`
--

LOCK TABLES `areas_riego` WRITE;
/*!40000 ALTER TABLE `areas_riego` DISABLE KEYS */;
INSERT INTO `areas_riego` VALUES (1,2,1,'Nogal Norte E2E',15.50,'2026-03-07 04:10:52','2026-03-07 04:10:52',NULL),(2,2,1,'Nogal Norte E2E',15.50,'2026-03-07 04:12:47','2026-03-07 04:12:47',NULL);
/*!40000 ALTER TABLE `areas_riego` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ciclos_cultivo`
--

DROP TABLE IF EXISTS `ciclos_cultivo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ciclos_cultivo`
--

LOCK TABLES `ciclos_cultivo` WRITE;
/*!40000 ALTER TABLE `ciclos_cultivo` DISABLE KEYS */;
INSERT INTO `ciclos_cultivo` VALUES (1,2,'2026-01-15','2026-06-30','2026-03-07 04:12:55','2026-03-07 04:12:55',NULL);
/*!40000 ALTER TABLE `ciclos_cultivo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES (1,2,'Agrícola López','614-555-1234',NULL,'2026-03-07 04:10:13','2026-03-07 04:10:13',NULL),(2,3,'Test Farm Co','555-0001',NULL,'2026-03-07 04:10:27','2026-03-07 04:10:27',NULL),(3,4,'Farm E2E','555-1234',NULL,'2026-03-07 04:14:22','2026-03-07 04:14:22',NULL),(4,5,'Farm E2E2',NULL,NULL,'2026-03-07 04:14:34','2026-03-07 04:14:34',NULL);
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lecturas`
--

DROP TABLE IF EXISTS `lecturas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lecturas`
--

LOCK TABLES `lecturas` WRITE;
/*!40000 ALTER TABLE `lecturas` DISABLE KEYS */;
INSERT INTO `lecturas` VALUES (1,1,'2026-03-07 14:30:00','2026-03-07 04:13:10'),(2,1,'2026-03-07 14:30:00','2026-03-07 04:13:16');
/*!40000 ALTER TABLE `lecturas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lecturas_ambiental`
--

DROP TABLE IF EXISTS `lecturas_ambiental`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lecturas_ambiental`
--

LOCK TABLES `lecturas_ambiental` WRITE;
/*!40000 ALTER TABLE `lecturas_ambiental` DISABLE KEYS */;
INSERT INTO `lecturas_ambiental` VALUES (1,1,28.10,55.00,12.50,650.00,5.200),(2,2,28.10,55.00,12.50,650.00,5.200);
/*!40000 ALTER TABLE `lecturas_ambiental` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lecturas_riego`
--

DROP TABLE IF EXISTS `lecturas_riego`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lecturas_riego`
--

LOCK TABLES `lecturas_riego` WRITE;
/*!40000 ALTER TABLE `lecturas_riego` DISABLE KEYS */;
INSERT INTO `lecturas_riego` VALUES (1,1,1,1250.00,8.30),(2,2,1,1250.00,8.30);
/*!40000 ALTER TABLE `lecturas_riego` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lecturas_suelo`
--

DROP TABLE IF EXISTS `lecturas_suelo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lecturas_suelo`
--

LOCK TABLES `lecturas_suelo` WRITE;
/*!40000 ALTER TABLE `lecturas_suelo` DISABLE KEYS */;
INSERT INTO `lecturas_suelo` VALUES (1,1,2.500,22.30,45.60,-0.8000),(2,2,2.500,22.30,45.60,-0.8000);
/*!40000 ALTER TABLE `lecturas_suelo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nodos`
--

DROP TABLE IF EXISTS `nodos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nodos`
--

LOCK TABLES `nodos` WRITE;
/*!40000 ALTER TABLE `nodos` DISABLE KEYS */;
INSERT INTO `nodos` VALUES (1,2,'ak_b2727bc1d95e342932612ee5573fdb18','NODE-E2E-001','Nodo Prueba E2E',28.6353000,-106.0889000,1,'2026-03-07 04:13:01','2026-03-07 04:13:01',NULL);
/*!40000 ALTER TABLE `nodos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `predios`
--

DROP TABLE IF EXISTS `predios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `predios`
--

LOCK TABLES `predios` WRITE;
/*!40000 ALTER TABLE `predios` DISABLE KEYS */;
INSERT INTO `predios` VALUES (1,2,'Rancho E2E','Km 5 Test','2026-03-07 04:10:36','2026-03-07 04:10:36',NULL),(2,2,'Rancho E2E','Km 5 Test','2026-03-07 04:10:42','2026-03-07 04:10:42',NULL);
/*!40000 ALTER TABLE `predios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipos_cultivo`
--

DROP TABLE IF EXISTS `tipos_cultivo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipos_cultivo`
--

LOCK TABLES `tipos_cultivo` WRITE;
/*!40000 ALTER TABLE `tipos_cultivo` DISABLE KEYS */;
INSERT INTO `tipos_cultivo` VALUES (1,'Nogal',NULL,'2026-03-07 03:45:57','2026-03-07 03:45:57',NULL),(2,'Alfalfa',NULL,'2026-03-07 03:45:57','2026-03-07 03:45:57',NULL),(3,'Manzana',NULL,'2026-03-07 03:45:57','2026-03-07 03:45:57',NULL),(4,'Maíz',NULL,'2026-03-07 03:45:57','2026-03-07 03:45:57',NULL),(5,'Chile',NULL,'2026-03-07 03:45:57','2026-03-07 03:45:57',NULL),(6,'Algodón',NULL,'2026-03-07 03:45:57','2026-03-07 03:45:57',NULL);
/*!40000 ALTER TABLE `tipos_cultivo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tokens_refresco`
--

DROP TABLE IF EXISTS `tokens_refresco`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tokens_refresco`
--

LOCK TABLES `tokens_refresco` WRITE;
/*!40000 ALTER TABLE `tokens_refresco` DISABLE KEYS */;
INSERT INTO `tokens_refresco` VALUES (1,1,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sIjoiYWRtaW4iLCJleHAiOjE3NzM0NjAzMDAsInR5cGUiOiJyZWZyZXNoIn0.QeGwx0wQ9baUuHleSDo9KDufSnuY7WntY5pvP4Gn5KU','2026-03-14 03:51:40','2026-03-07 03:51:40',NULL),(2,1,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sIjoiYWRtaW4iLCJleHAiOjE3NzM0NjAzMDUsInR5cGUiOiJyZWZyZXNoIn0.ci9_ts2Kdmt1b16ioUMNq49uMaA3oyd-iKQmO4Z5d1M','2026-03-14 03:51:45','2026-03-07 03:51:45','2026-03-07 03:51:55'),(3,1,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sIjoiYWRtaW4iLCJleHAiOjE3NzM0NjAzMzIsInR5cGUiOiJyZWZyZXNoIn0.5xn4Rb4G8zzphF8Uoy6htokzh4Fbai9PKFk5rWBFhXw','2026-03-14 03:52:12','2026-03-07 03:52:12','2026-03-07 03:52:30'),(4,1,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sIjoiYWRtaW4iLCJleHAiOjE3NzM0NjEzODcsInR5cGUiOiJyZWZyZXNoIn0.__a9bcr14VvLjirZXOb83frFFKRm6XnTjSk__BLtIvI','2026-03-14 04:09:47','2026-03-07 04:09:47',NULL),(5,1,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sIjoiYWRtaW4iLCJleHAiOjE3NzM0NjEzOTMsInR5cGUiOiJyZWZyZXNoIn0.gDwh8xZCFrjibZ1wTHmW-1Rs0v0KUaqw0t_vhsAIFPE','2026-03-14 04:09:53','2026-03-07 04:09:53',NULL),(6,1,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sIjoiYWRtaW4iLCJleHAiOjE3NzM0NjE1NjAsInR5cGUiOiJyZWZyZXNoIn0.xqQ4ICVPJKEhEI6WlNmIa4GluU4Sy6ANu4Au_TyZl6A','2026-03-14 04:12:40','2026-03-07 04:12:40',NULL),(7,5,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1Iiwicm9sIjoiY2xpZW50ZSIsImV4cCI6MTc3MzQ2MTY4MiwidHlwZSI6InJlZnJlc2gifQ.8R8BRLJi68-tbr8ZsnushZZis3L_sMV2SBf3LI4SQ8Y','2026-03-14 04:14:42','2026-03-07 04:14:42',NULL);
/*!40000 ALTER TABLE `tokens_refresco` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'admin@sensores.com','$2b$12$o5lKHE2qODH9CqmfGkl/JeqU2ecqPh5wyH1e/.wrHSiL1CvE.Tulm','Administrador','admin',1,'2026-03-07 03:45:57','2026-03-07 03:45:57',NULL),(2,'jlopez@test.com','$2b$12$ggINUAEBVqA7cwWOgneroutIXRzD.NTbwt35g2dcu6wDtDSh2MX1a','Juan López','cliente',1,'2026-03-07 04:10:13','2026-03-07 04:10:13',NULL),(3,'test_e2e@test.com','$2b$12$WzIQzt.er7ry8R9OdHRVxu.7J0LxXIyn1WkvXRVoesy6NwTg4cjxS','E2E Test User','cliente',1,'2026-03-07 04:10:27','2026-03-07 04:10:27',NULL),(4,'cliente_e2e@test.com','$2b$12$Y0cf0TDQ5AwCZgr95H1c6OmoOQwg5LtdIELWlACNS3hfvB7QiqkTG','Cliente E2E','cliente',1,'2026-03-07 04:14:22','2026-03-07 04:14:22',NULL),(5,'cliente_e2e2@test.com','$2b$12$ULhgAQ3/v.5LGbU.Yae52.Qzj97sa9M76rj6gR3HLU1F3zydAgGqC','Cliente E2E2','cliente',1,'2026-03-07 04:14:34','2026-03-07 04:14:34',NULL);
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'sensores_riego'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-13  4:22:21
