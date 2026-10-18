namespace RoomConditions.v2.Dtos
{
    public record MjerenjeOkolineResponse
    (
        int Id,
        string DeviceId,
        decimal TemperaturaC,
        decimal VlaznostZraka,
        DateTime DatumVrijemePrijemaUtc,
        bool KlimaUkljucena
    );
}
