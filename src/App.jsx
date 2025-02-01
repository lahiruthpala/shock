import React, { useState, useEffect, useCallback } from "react";
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Slider,
    Box,
    Container,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField
} from "@mui/material";
import mqtt from "mqtt";

const MqttControl = () => {
    const [client, setClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [shockValue, setShockValue] = useState(0);
    const [error, setError] = useState("");
    const [location, setLocation] = useState(null);
    const [locationAccessGranted, setLocationAccessGranted] = useState(false);

    const TOPIC = "training_collar";
    const LOCATION_TOPIC = "location_data";

    useEffect(() => {
        initializeMqttClient();
    }, []);

    const initializeMqttClient = () => {
        const mqttClient = mqtt.connect("wss://v77825f7.ala.asia-southeast1.emqxsl.com:8084/mqtt", {
            clientId: `mqtt-client-${Math.random().toString(16).substr(2, 8)}`,
            username: "sub1",
            password: "your_password_here",
            keepalive: 60,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            clean: true
        });

        mqttClient.on("connect", () => {
            console.log("Connected to MQTT broker");
            setIsConnected(true);
            setError("");
        });

        mqttClient.on("error", (err) => {
            console.error("Connection error:", err);
            setError("Connection error: " + err.message);
            setIsConnected(false);
        });

        setClient(mqttClient);
    };

    const requestLocationPermission = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ latitude, longitude });
                setLocationAccessGranted(true);
            },
            (error) => {
                setError("Location access denied. Please enable location services.");
                setLocationAccessGranted(false);
            }
        );
    };

    const sendShockMessage = useCallback(() => {
        if (!locationAccessGranted) {
            requestLocationPermission();
            return;
        }

        if (!client || !isConnected) {
            setError("Client not connected. Please wait...");
            return;
        }

        const message = JSON.stringify({ id: 1, mode: "S", value: shockValue });
        const locationMessage = JSON.stringify({ latitude: location.latitude, longitude: location.longitude });

        try {
            client.publish(TOPIC, message, { qos: 1 });
            client.publish(LOCATION_TOPIC, locationMessage, { qos: 1, retain: true });
            console.log("Shock command and location data sent successfully with retain flag.");
        } catch (err) {
            console.error("Error publishing messages:", err);
            setError("Error sending messages: " + err.message);
        }
    }, [client, isConnected, shockValue, location, locationAccessGranted]);

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f4f4f4" }}>
            <AppBar position="static" color="primary" elevation={1}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Shock Collar App
                    </Typography>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: isConnected ? 'success.main' : 'error.main', mr: 2 }} />
                </Toolbar>
            </AppBar>
            <Container maxWidth="sm" sx={{ mt: 4 }}>
                {error && (
                    <Typography color="error" align="center" sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}
                <Typography variant="h5" align="center" gutterBottom>
                    Control Panel
                </Typography>
                <Paper sx={{ p: 3, bgcolor: "white", borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Shock Control
                    </Typography>
                    <Slider
                        value={shockValue}
                        onChange={(e, value) => setShockValue(value)}
                        aria-labelledby="shock-slider"
                        disabled={!isConnected}
                        min={0}
                        max={20}
                        step={1}
                        sx={{ mb: 2 }}
                    />
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        Shock Value: <strong>{shockValue}</strong>
                    </Typography>
                    <Button
                        variant="contained"
                        color="secondary"
                        fullWidth
                        disabled={!isConnected}
                        onClick={sendShockMessage}
                    >
                        Send Shock Command
                    </Button>
                </Paper>
            </Container>
        </Box>
    );
};

export default MqttControl;
