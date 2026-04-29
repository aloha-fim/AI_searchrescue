from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_roles
from ..database import get_db
from ..models import (
    SupplyItem, SupplyTransaction, Incident, User, UserRole
)
from ..schemas import (
    SupplyItemCreate, SupplyItemOut, SupplyItemUpdate,
    SupplyTransactionCreate, SupplyTransactionOut,
)

router = APIRouter(prefix="/api/supplies", tags=["supplies"])


# Anyone authenticated can view supplies; only rescuers can mutate.
@router.get("", response_model=List[SupplyItemOut])
def list_supplies(
    low_stock_only: bool = Query(default=False),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(SupplyItem)
    if category:
        q = q.filter(SupplyItem.category == category)
    if low_stock_only:
        q = q.filter(SupplyItem.quantity <= SupplyItem.minimum_quantity)
    return q.order_by(SupplyItem.category, SupplyItem.name).all()


@router.post("", response_model=SupplyItemOut)
def create_supply(
    payload: SupplyItemCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.WATCHSTANDER, UserRole.ADMIN)),
):
    if db.query(SupplyItem).filter(SupplyItem.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Supply with that name already exists")
    item = SupplyItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=SupplyItemOut)
def update_supply(
    item_id: int,
    payload: SupplyItemUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.WATCHSTANDER, UserRole.ADMIN)),
):
    item = db.query(SupplyItem).filter(SupplyItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_supply(
    item_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.ADMIN)),
):
    item = db.query(SupplyItem).filter(SupplyItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{item_id}/transactions", response_model=SupplyTransactionOut)
def add_transaction(
    item_id: int,
    payload: SupplyTransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.PILOT, UserRole.SWIMMER, UserRole.WATCHSTANDER, UserRole.ADMIN
    )),
):
    item = db.query(SupplyItem).filter(SupplyItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    if payload.incident_id is not None:
        if not db.query(Incident).filter(Incident.id == payload.incident_id).first():
            raise HTTPException(status_code=400, detail="Unknown incident_id")

    if payload.phase not in ("pre", "during", "post"):
        raise HTTPException(status_code=400, detail="phase must be pre|during|post")

    new_qty = item.quantity + payload.change
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Cannot reduce quantity below zero")
    item.quantity = new_qty

    txn = SupplyTransaction(
        item_id=item_id,
        incident_id=payload.incident_id,
        performed_by_id=user.id,
        change=payload.change,
        reason=payload.reason,
        phase=payload.phase,
        note=payload.note or "",
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.get("/{item_id}/transactions", response_model=List[SupplyTransactionOut])
def list_transactions(
    item_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return (
        db.query(SupplyTransaction)
        .filter(SupplyTransaction.item_id == item_id)
        .order_by(desc(SupplyTransaction.created_at))
        .limit(200)
        .all()
    )
