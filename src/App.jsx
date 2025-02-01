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
    const [vibrationValue, setVibrationValue] = useState(0);
    const [error, setError] = useState("");
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const TOPIC = "training_collar";

    useEffect(() => {
        // Check for stored password
        const storedPassword = localStorage.getItem('mqtt_password');
        if (!storedPassword) {
            setShowPasswordDialog(true);
        } else {
            setIsAuthenticated(true);
            initializeMqttClient(storedPassword);
        }
    }, []);

    const handlePasswordSubmit = () => {
        if (password) {
            localStorage.setItem('mqtt_password', password);
            setIsAuthenticated(true);
            setShowPasswordDialog(false);
            initializeMqttClient(password);
        }
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

    const initializeMqttClient = (mqttPassword) => {
        const mqttClient = mqtt.connect("wss://v77825f7.ala.asia-southeast1.emqxsl.com:8084/mqtt", {
            clientId: `mqtt-client-${Math.random().toString(16).substr(2, 8)}`,
            username: "sub1",
            password: mqttPassword,
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

            // If authentication fails, clear stored password and show dialog
            if (err.message.includes("auth")) {
                localStorage.removeItem('mqtt_password');
                setIsAuthenticated(false);
                setShowPasswordDialog(true);
            }
        });

        mqttClient.on("offline", () => {
            console.log("Client went offline");
            setIsConnected(false);
            setError("Client offline - trying to reconnect...");
        });

        mqttClient.on("reconnect", () => {
            console.log("Attempting to reconnect...");
            setError("Attempting to reconnect...");
        });

        setClient(mqttClient);

        return () => {
            if (mqttClient) {
                mqttClient.end(true, {}, () => {
                    console.log("Disconnected from MQTT broker");
                });
            }
        };
    };

    const sendShockMessage = useCallback(() => {
        if (!client || !isConnected) {
            setError("Client not connected. Please wait...");
            return;
        }

        const message = JSON.stringify({ id: 1, mode: "S", value: shockValue });

        try {
            client.publish(TOPIC, message, { qos: 1 }, (err) => {
                if (err) {
                    console.error("Failed to publish shock command:", err);
                    setError("Failed to send shock command: " + err.message);
                } else {
                    console.log("Shock command sent successfully:", message);
                    setError("");
                }
            });
        } catch (err) {
            console.error("Error publishing shock command:", err);
            setError("Error sending shock command: " + err.message);
        }
    }, [client, isConnected, shockValue]);

    const sendVibrationMessage = useCallback(() => {
        if (!client || !isConnected) {
            setError("Client not connected. Please wait...");
            return;
        }

        if (!locationAccessGranted) {
            requestLocationPermission();
            return;
        }
        const locationMessage = JSON.stringify({ latitude: location.latitude, longitude: location.longitude });

        const message = JSON.stringify({ id: 1, mode: "V", value: vibrationValue });

        try {
            client.publish(TOPIC, message, { qos: 1 });
            client.publish(LOCATION_TOPIC, locationMessage, { qos: 1, retain: true });
            console.log("Shock command and location data sent successfully with retain flag.");
        } catch (err) {
            console.error("Error publishing messages:", err);
            setError("Error sending messages: " + err.message);
        }
    }, [client, isConnected, vibrationValue]);

    if (!isAuthenticated) {
        return (
            <Dialog open={showPasswordDialog} onClose={() => {}} disableEscapeKeyDown>
                <DialogTitle>Enter Password</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Password"
                        type="password"
                        fullWidth
                        variant="outlined"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handlePasswordSubmit();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handlePasswordSubmit} variant="contained" color="primary">
                        Connect
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f4f4f4" }}>
            <AppBar position="static" color="primary" elevation={1}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Shock Collar App
                    </Typography>
                    <Box sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: isConnected ? 'success.main' : 'error.main',
                        mr: 2
                    }} />
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

                <Typography variant="body2" align="center" sx={{ mb: 3 }} color={isConnected ? 'success.main' : 'error.main'}>
                    Status: {isConnected ? "Connected" : "Disconnected"}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Shock Control Section */}
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

                    {/* Vibration Control Section */}
                    <Paper sx={{ p: 3, bgcolor: "white", borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Vibration Control
                        </Typography>
                        <Slider
                            value={vibrationValue}
                            onChange={(e, value) => setVibrationValue(value)}
                            aria-labelledby="vibration-slider"
                            disabled={!isConnected}
                            min={0}
                            max={100}
                            step={1}
                            sx={{ mb: 2 }}
                        />
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Vibration Value: <strong>{vibrationValue}</strong>
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            disabled={!isConnected}
                            onClick={sendVibrationMessage}
                        >
                            Send Vibration Command
                        </Button>
                    </Paper>
                </Box>
            </Container>
        </Box>
    );
};

export default MqttControl;