from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.linear_model import LinearRegression


class PriceObservation(BaseModel):
    price: float = Field(ge=0)
    checked_at: datetime


class PredictionRequest(BaseModel):
    observations: list[PriceObservation] = Field(min_length=7)
    horizon_days: int = Field(default=7, ge=1, le=365)


class PredictionResponse(BaseModel):
    predicted_price: float
    confidence: float
    horizon_days: int
    training_observation_count: int
    trained_through: datetime
    model_version: str = "linear-regression-v1"


app = FastAPI(title="PRISM ML Service", version="0.1.0")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict_price(request: PredictionRequest) -> PredictionResponse:
    observations = sorted(request.observations, key=lambda item: item.checked_at)
    first_checked_at = observations[0].checked_at
    features = [
        [(item.checked_at - first_checked_at).total_seconds() / 86_400]
        for item in observations
    ]
    prices = [item.price for item in observations]

    if len(set(feature[0] for feature in features)) < 2:
        raise HTTPException(
            status_code=422,
            detail="Observations must contain at least two different timestamps.",
        )

    model = LinearRegression().fit(features, prices)
    final_day = features[-1][0]
    predicted_price = max(
        0,
        float(model.predict([[final_day + request.horizon_days]])[0]),
    )
    confidence = max(0, min(1, float(model.score(features, prices)))) * 100

    return PredictionResponse(
        predicted_price=round(predicted_price, 2),
        confidence=round(confidence, 2),
        horizon_days=request.horizon_days,
        training_observation_count=len(observations),
        trained_through=observations[-1].checked_at,
    )
